# ScopeCheck planning and build packet

Prepared for Bhavi Patel for PMAI Hack For Impact on October 17 2026.

This packet executes Ask, Imagine and Plan. It is not a built or tested application. All product artifacts are fictional. Model outputs and benchmarks have not been run. Check the event rules before importing prepared materials into the submission.

Start with PROJECT_PLAYBOOK.md, then prompts/antigravity_tasks.md. The fixtures supply a demonstration input and a clearly labeled manually authored illustrative review. contracts/analysis.schema.json is the planned output contract; contracts/review_state.json describes application-owned state. evaluation/acceptance_cases.json defines expected behavior and benchmark methods. Do not put evaluation expectations or the illustrative response into the model's analysis context during tests.

The chosen app stack is Next.js App Router, TypeScript, Tailwind, @google/genai, Zod and localStorage. Development assistance: Google Antigravity. Optional deployment: Vercel after the local app works. One server-only Gemini API key and working quota are required for live analysis. A working account and model have not been verified here.

## Run the app locally

The Next.js app lives in this folder. With Node 20 or newer:

```
cd scopecheck
npm install
npm run dev
```

Open http://localhost:3000. The two sample pull requests use a fictional project with a hand-written analysis. To try your own code, click **Analyze your code**:

- **Upload a folder:** pick a project folder, choose a file, edit it in the browser, then click Find affected files.
- **GitHub pull request:** paste a link to a pull request in a public repository.

Your files stay in the browser. The scan for your own code is a keyword scan (lib/analyze.ts): it collects the names and values the change removes, renames or edits, plus the function that contains each changed line, then quotes every line elsewhere in the project that uses them. It reads names, not meaning, so treat its verdicts as a starting point for review.
