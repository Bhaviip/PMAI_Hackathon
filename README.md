# ScopeCheck

World's First Dynamic Ergonomic Team: Bhavi Patel, Pranav Dixit, Urmila Das

**See what a code change affects before you merge it.**

You give ScopeCheck a code change. It shows every other file in the project that the change touches, marks how serious each one is, and points to the exact lines that prove it.

It doesn't approve or reject anything. It shows you what to look at.

## What you see

- **A verdict** at the top, such as "2 files will break" or "Nothing else is affected."
- **A map** with the changed file in the middle and each affected file around it.
- **Proof** beside the map for each affected file, showing the real lines from that file with the evidence highlighted.
- **The change** below them, as a short before-and-after diff.

Each affected file gets one of four labels:

| Label | Meaning |
| --- | --- |
| Breaks | This file uses something the change removed or renamed. |
| Needs update | A test or doc that describes the old behavior. |
| Check | This file depends on the changed code, so it's worth a look. |
| Still safe | Related, but not affected. |

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```
git clone https://github.com/Bhaviip/PMAI_Hackathon.git
cd PMAI_Hackathon/scopecheck
npm install
npm run dev
```

Open http://localhost:3000. The fonts download from Google the first time, so you need internet on that first run.

### Turn on the AI check (optional)

From the `scopecheck` folder, copy `.env.example` to `.env.local` and add one key:

```
cp .env.example .env.local
# then edit .env.local and set ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY (Gemini)
```

Restart `npm run dev`. The **Analyze your code** screen shows "AI check on" with the model name. Without a key, everything still works as a keyword scan, and the page says so.

## Try it

There are three ways to try it, from quickest to most real.

**1. Sample pull requests.** These are already loaded when the page opens. Click one in the left sidebar. They use a made-up project called Parcel Help.

**2. A real pull request on GitHub.**
Click **Analyze your code**, choose **GitHub pull request**, and paste one of these links:

| Link | What it changes | What you should see |
| --- | --- | --- |
| [demo-repo PR 1](https://github.com/pdixit0804/demo-repo/pull/1) | Renames a function but only updates one caller | 2 Breaks, 3 Needs update (the best demo) |
| [demo-repo PR 2](https://github.com/pdixit0804/demo-repo/pull/2) | Renames an order status | 1 Breaks, 2 Needs update, 3 Check |
| [demo-repo PR 3](https://github.com/pdixit0804/demo-repo/pull/3) | Raises the free shipping threshold | 2 Needs update, 1 Check |
| [demo-repo PR 4](https://github.com/pdixit0804/demo-repo/pull/4) | Tidies an internal helper | Nothing affected (the safe example) |

These counts are from the keyword scan. With the AI check on, the AI can move a file to a different label or add one the scan missed, and each AI verdict still shows its quoted lines.

Any public pull request works. GitHub allows about 60 requests an hour without signing in, so if it stops loading, wait a bit.

**3. Your own folder.**
Click **Analyze your code**, choose **Upload a folder**, and pick a project folder. Choose a file, edit it right in the browser, then click **Find affected files**. Your files stay in your browser. With the AI check on, only the change and short excerpts of the affected files are sent to the model.

## Check the code

From the `scopecheck` folder:

```
npm test            # automated tests: diff, scan and AI-check validation
npm run lint        # code style
npx tsc --noEmit    # type check
npm run build       # production build
```

All four should finish with no errors. The demo PRs above are a good check that results look right on real code.

## How it works

The keyword scan runs in the browser. The optional AI check runs through a small server route, so the API key never reaches the browser.

1. **Read the change.** It compares each changed file before and after.
2. **Find what changed.** It collects the names and values that were removed, renamed or edited, plus the top-level function each changed line sits in.
3. **Search the project.** It finds every other file that uses those names, then sorts the results by how serious they are.
4. **Check with AI (optional).** One model call judges each flagged file, plus files that import the changed file, and gives a plain reason with quoted lines.
5. **Show proof.** Every result quotes real lines from the file. An AI verdict whose quote isn't in the file is not used, and the keyword result is kept and labeled as a keyword match.

The scan is in `lib/analyze.ts` and the AI check is in `lib/aiReview.ts` and `app/api/review/`. The screen is `app/page.tsx` and the map is `components/ImpactMap.tsx`.

## Limits

The keyword scan matches names, not meaning. It catches renames, removed values and changed functions well, and can miss a change in behavior that keeps every name the same. The AI check judges meaning, but it can still be wrong, so every verdict shows the lines it is based on. The AI check needs an API key, and the free Gemini tier is slow and limited to about 20 requests a day per model. Only public GitHub repositories work without signing in.

## More

- [WORKFLOW.md](scopecheck/WORKFLOW.md) explains how we built it.
- [PROJECT_PLAYBOOK.md](scopecheck/PROJECT_PLAYBOOK.md) and [TEAMMATE_PITCH.md](scopecheck/TEAMMATE_PITCH.md) are the original planning notes.






hi 
