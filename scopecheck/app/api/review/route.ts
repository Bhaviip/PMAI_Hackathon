// Server route for the AI check. The API key never reaches the browser.
//   GET  /api/review  -> whether an AI provider is configured, and which model
//   POST /api/review  -> one model call that judges the scan's files (lib/aiReview.ts)
// Failures return an error code and message; the browser then keeps the keyword
// scan's results and says so, rather than showing anything made up.

import { connection } from "next/server";
import {
  MAX_REQUEST_CHARS,
  REPLY_JSON_SCHEMA,
  ReviewReplySchema,
  ReviewRequestSchema,
  SYSTEM_PROMPT,
  checkReply,
  requestText,
} from "@/lib/aiReview";
import { AnalyzeFailure, selectProvider, type AnalyzeErrorCode } from "./providers";

// Room above the model timeout on hosts that cap how long a request may run.
export const maxDuration = 60;

// 45 s by default; MODEL_TIMEOUT_MS raises it when a provider is congested.
const TIMEOUT_MS = Number(process.env.MODEL_TIMEOUT_MS) || 45_000;

function fail(status: number, code: AnalyzeErrorCode, message: string, details?: string[]) {
  return Response.json({ ok: false, error: { code, message, details } }, { status });
}

export async function GET() {
  // Read the environment per request, not once at build time.
  await connection();
  try {
    const provider = selectProvider();
    return Response.json({ configured: true, provider: provider.name, model: provider.model });
  } catch (err) {
    return Response.json({ configured: false, reason: err instanceof Error ? err.message : "No AI provider configured" });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_request", "Request body must be JSON");
  }
  const parsed = ReviewRequestSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid_request", "The review request is not valid", parsed.error.issues.map((i) => i.message));
  const req = parsed.data;
  const user = requestText(req);
  if (user.length > MAX_REQUEST_CHARS) {
    return fail(413, "invalid_request", `The change is too large to check (${user.length} characters; limit ${MAX_REQUEST_CHARS}).`);
  }

  let text: string;
  let model: string;
  try {
    const provider = selectProvider();
    model = provider.model;
    text = await provider.generate({
      system: SYSTEM_PROMPT,
      user,
      schema: REPLY_JSON_SCHEMA as unknown as Record<string, unknown>,
      timeoutMs: TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof AnalyzeFailure) return fail(err.status, err.code, err.message, err.details);
    throw err;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(502, "invalid_json", "The model's reply was not valid JSON.", [text.slice(0, 300)]);
  }
  const reply = ReviewReplySchema.safeParse(raw);
  if (!reply.success) {
    return fail(502, "contract_mismatch", "The model's reply did not match the expected shape.", reply.error.issues.map((i) => i.message));
  }
  return Response.json({ ok: true, model, result: checkReply(req, reply.data) });
}
