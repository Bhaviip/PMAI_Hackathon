import Anthropic from "@anthropic-ai/sdk";
import { ApiError, GoogleGenAI } from "@google/genai";

export type AnalyzeErrorCode =
  | "invalid_request"
  | "missing_key"
  | "timeout"
  | "model_unavailable"
  | "quota"
  | "model_busy"
  | "auth"
  | "refused"
  | "truncated"
  | "empty_response"
  | "invalid_json"
  | "contract_mismatch"
  | "upstream_error";

/** A provider failure already mapped to the route's error contract. */
export class AnalyzeFailure extends Error {
  constructor(
    public readonly status: number,
    public readonly code: AnalyzeErrorCode,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
  }
}

export type ModelCall = {
  system: string;
  user: string;
  /** contracts/analysis.schema.json without $schema/title. */
  schema: Record<string, unknown>;
  timeoutMs: number;
};

export type Provider = {
  name: "gemini" | "anthropic";
  model: string;
  /** Returns the model's raw JSON text. One call, no tools, no retries. */
  generate: (call: ModelCall) => Promise<string>;
};

const timeoutFailure = (ms: number) =>
  new AnalyzeFailure(504, "timeout", `The model did not finish within ${ms / 1000} seconds. You can retry once.`);

function gemini(apiKey: string, model: string): Provider {
  const ai = new GoogleGenAI({ apiKey });
  return {
    name: "gemini",
    model,
    async generate({ system, user, schema, timeoutMs }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await ai.models.generateContent({
          model,
          contents: user,
          config: {
            systemInstruction: system,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            abortSignal: controller.signal,
            httpOptions: { timeout: timeoutMs },
          },
        });
        if (!response.text) throw new AnalyzeFailure(502, "empty_response", "The model returned no text.");
        return response.text;
      } catch (err) {
        if (err instanceof AnalyzeFailure) throw err;
        if (controller.signal.aborted || (err instanceof Error && /abort|timeout/i.test(err.name + err.message))) {
          throw timeoutFailure(timeoutMs);
        }
        if (err instanceof ApiError) {
          if (err.status === 504 || /DEADLINE_EXCEEDED/.test(err.message)) throw timeoutFailure(timeoutMs);
          if (err.status === 404) {
            throw new AnalyzeFailure(502, "model_unavailable", `Model "${model}" is not available to this API key. Set GEMINI_MODEL to a model your account can use.`);
          }
          if (err.status === 429) {
            throw new AnalyzeFailure(502, "quota", "Gemini quota or rate limit reached. Check your AI Studio quota.", [err.message]);
          }
          if (err.status === 503) {
            throw new AnalyzeFailure(502, "model_busy", `Model "${model}" is overloaded right now. Wait a minute and retry.`);
          }
          if (err.status === 401 || err.status === 403 || /API_KEY_INVALID|API key not valid/.test(err.message)) {
            throw new AnalyzeFailure(502, "auth", "Gemini rejected the API key. Check GEMINI_API_KEY in .env.local.");
          }
          throw new AnalyzeFailure(502, "upstream_error", `Gemini returned HTTP ${err.status}`, [err.message]);
        }
        throw new AnalyzeFailure(502, "upstream_error", "The Gemini request failed", [err instanceof Error ? err.message : String(err)]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Structured outputs reject numeric and array-size constraints; validateAnalysis enforces them instead. */
export function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([k]) => !["minimum", "maximum", "minItems", "maxItems", "minLength", "maxLength"].includes(k))
        .map(([k, v]) => [k, stripUnsupported(v)]),
    );
  }
  return node;
}

function anthropic(apiKey: string, model: string): Provider {
  // maxRetries 0: one call per analysis; the user decides whether to retry.
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  return {
    name: "anthropic",
    model,
    async generate({ system, user, schema, timeoutMs }) {
      try {
        const response = await client.beta.messages.create(
          {
            model,
            max_tokens: 16000,
            system,
            messages: [{ role: "user", content: user }],
            output_config: {
              effort: "medium",
              format: { type: "json_schema", schema: stripUnsupported(schema) as Record<string, unknown> },
            },
            // On a safety-classifier decline, the API re-runs on its recommended fallback model.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          },
          { timeout: timeoutMs },
        );
        if (response.stop_reason === "refusal") {
          const why = response.stop_details?.explanation;
          throw new AnalyzeFailure(502, "refused", "The model declined this request.", why ? [why] : undefined);
        }
        if (response.stop_reason === "max_tokens") {
          throw new AnalyzeFailure(502, "truncated", "The model ran out of output tokens before finishing.");
        }
        const text = response.content
          .flatMap((b) => (b.type === "text" ? [b.text] : []))
          .join("");
        if (!text) throw new AnalyzeFailure(502, "empty_response", "The model returned no text.");
        return text;
      } catch (err) {
        if (err instanceof AnalyzeFailure) throw err;
        if (err instanceof Anthropic.APIConnectionTimeoutError) throw timeoutFailure(timeoutMs);
        if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
          throw new AnalyzeFailure(502, "auth", "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in .env.local.");
        }
        if (err instanceof Anthropic.NotFoundError) {
          throw new AnalyzeFailure(502, "model_unavailable", `Model "${model}" is not available to this API key. Set ANTHROPIC_MODEL.`);
        }
        if (err instanceof Anthropic.RateLimitError) {
          throw new AnalyzeFailure(502, "quota", "Anthropic rate limit or spend limit reached.", [err.message]);
        }
        if (err instanceof Anthropic.InternalServerError && err.status === 529) {
          throw new AnalyzeFailure(502, "model_busy", `Model "${model}" is overloaded right now. Wait a minute and retry.`);
        }
        if (err instanceof Anthropic.APIError) {
          throw new AnalyzeFailure(502, "upstream_error", `Anthropic returned HTTP ${err.status ?? "error"}`, [err.message]);
        }
        throw new AnalyzeFailure(502, "upstream_error", "The Anthropic request failed", [err instanceof Error ? err.message : String(err)]);
      }
    },
  };
}

/**
 * AI_PROVIDER picks the provider explicitly. Unset, it prefers Anthropic when
 * ANTHROPIC_API_KEY is present, otherwise Gemini.
 */
export function selectProvider(env: NodeJS.ProcessEnv = process.env): Provider {
  const choice = env.AI_PROVIDER?.trim().toLowerCase() || (env.ANTHROPIC_API_KEY ? "anthropic" : "gemini");
  if (choice === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) {
      throw new AnalyzeFailure(500, "missing_key", "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local and restart the dev server.");
    }
    return anthropic(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5");
  }
  if (choice === "gemini") {
    if (!env.GEMINI_API_KEY) {
      throw new AnalyzeFailure(500, "missing_key", "GEMINI_API_KEY is not set on the server. Add it to .env.local and restart the dev server.");
    }
    return gemini(env.GEMINI_API_KEY, env.GEMINI_MODEL?.trim() || "gemini-3.8-flash");
  }
  throw new AnalyzeFailure(500, "missing_key", `Unknown AI_PROVIDER "${choice}". Use "anthropic" or "gemini".`);
}
