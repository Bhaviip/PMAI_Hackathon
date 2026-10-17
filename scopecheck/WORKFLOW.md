# How ScopeCheck was built

The workflow behind the ScopeCheck prototype for PMAI Hack For Impact, October 17 2026. It ran as a loop: build a small working piece, show it, take feedback, and change direction quickly.

## 1. Start from a written plan
- Read `PROJECT_PLAYBOOK.md` and `prompts/antigravity_tasks.md` to learn the user, the scope and the first build task.
- Picked the stack the plan named: Next.js, TypeScript and Tailwind in one app, with no database and no login.

## 2. Build the smallest thing that runs
- Scaffolded the app and built the first screen from the fictional demo packet.
- Checked every step the same way before sharing: typecheck, lint, a production build, and a scripted walk-through in a real browser (Playwright) with screenshots.
- Opened a draft pull request so every change has a link and a history.

## 3. Get it running on a teammate's laptop
- Installed Node, cloned the repo, ran `npm install` and `npm run dev`, and opened `localhost:3000`.
- Real use found real bugs. For example, Accept looked broken because the role box scrolled out of view. Each one was fixed, tested and pushed within minutes.

## 4. Change direction when the concept is wrong
- Feedback: too wordy, and accept/reject review already exists. The real value is showing what a code change affects, with proof.
- Rebuilt the core screen around that idea: pick a change, see a map of affected files, and click any file to see the exact lines that justify the verdict.
- Kept the demo honest. Sample data is labeled as sample, and every quoted line is checked against the file before it is shown.

## 5. Make it usable on real code
- Added two ways in: upload a project folder and edit a file in the browser, or paste a public GitHub pull request link.
- Wrote a transparent keyword scan instead of a black box. It finds names and values that the change removes, renames or edits, plus the function around each changed line, then quotes every place they are used.
- Tuned it on real projects, including ScopeCheck's own code, and cut false alarms each time. Renaming a function now flags exactly the files that call it.

## 6. Polish for the pitch
- Design passes: a pull-request layout, a readable impact map, and a proof panel beside the map with previous and next controls.
- Fixed what broke on real pull requests: long file names, many affected files, raw markdown in descriptions, and code cut off at the edge.

## How the real product would get the code
1. A team installs ScopeCheck on GitHub once.
2. When someone opens a pull request, GitHub sends the diff.
3. ScopeCheck finds the code, tests and docs connected to what changed.
4. Each one is judged as breaks, needs update, check, or still safe, and the proof line is checked before it is shown.
5. A link is posted on the pull request so reviewers see the impact before they merge.

## Honest limits and next step
- The scan matches names, not meaning. A break with no shared name, like the analytics example in the sample, needs an AI step. That is the next thing to build.
- Public repositories only, with GitHub's limit of about 60 unsigned requests an hour.
