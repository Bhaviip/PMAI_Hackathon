# Antigravity task sequence

Use one coding session at a time on the shared branch. Each task should list changed files and verification performed. Keep application source unbuilt until the competition start if the announced rules require that. This packet is a planning specification.

## Task 1 Scaffold and screen
Build ScopeCheck as one Next.js App Router app with TypeScript and Tailwind. Use a split view: planning packet on the left and review findings on the right. Implement Setup, Review, and Export as steps in one app. Load fixtures/demo_packet.json. Display the example review ONLY in a separate, prominent Sample review mode labeled illustrative. Do not imply it is a live API result. Do not add auth, a database, live ticket integrations, or a graph library. Keep Gemini API access on the server. Start with UI and deterministic review state; verify the app runs locally.

## Task 2 Contract and validation
Implement the model response type from contracts/analysis.schema.json. Validate requests (max 8 artifacts; 30000 total characters across change request, constraints, metadata and section text) and responses with Zod. Whitelist unique artifact IDs, unique section IDs per artifact, and unique finding IDs. Require exactly one classification per supplied artifact. Check each quote exists verbatim inside the identified section. Reject or withhold invalid findings from approval. Require a proposed revision only for update findings; reject non-empty revisions on preserve, unaffected, or question. Owners come from supplied metadata, not invention. Add focused tests for malformed output, unknown IDs, missing classifications, invalid quotes, and excess input size.

## Task 3 Real analysis
Implement POST /api/analyze using the official @google/genai SDK, JSON Schema structured output, and prompts/analysis_system.txt. Use server-only GEMINI_API_KEY and configurable GEMINI_MODEL. The current official structured-output example uses gemini-3.8-flash; verify that exact model is accessible with the chosen account and pin a working structured-output model. Use one model call per analysis, a 45-second timeout and one user-initiated retry. Store model ID, prompt version and run ID for the local review. No web search, file search, tool execution or customer messages. Run the main fixture through the real endpoint and report the response and validation failures honestly. Never fall back silently to sample output.

## Task 4 Human review and export
Implement pending, accepted, rejected and needs_clarification review states owned exclusively by the application. Require a reviewer role for accepted proposals. Let the reviewer edit suggested wording and record a note. Keep original text immutable. Persist the single-user run in localStorage with a clear Reset control. On any input change, invalidate approvals and require a new run. Export Markdown with Approved proposals, Protected rules, Open questions and Review summary. Only accepted update findings go into Approved proposals, using final edited wording. Include source IDs and reviewer decisions. Export is a proposed change packet, not confirmation that external issues changed. Add tests for rejected/pending exclusion, edited wording and stale-approval invalidation.

## Task 5 Browser verification and polish
Run the core acceptance cases. In a real browser, load the fixture, analyze, open source evidence, edit and accept one suggestion, reject another, export, refresh and reset. Check narrow laptop layouts, loading, empty and error states. Record any remaining failures. Run build/typecheck and focused tests. Do not add features. If the environment cannot run browser automation, complete and document the same manual walkthrough.

## Done criteria
A real request yields validated findings; a human can review and export; preserved policies stay visible; tests detect bad citations and stale approvals. A sample-only UI is a prototype fallback and must be presented as such.
