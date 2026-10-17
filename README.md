# ScopeCheck

**See what a code change affects before you merge it.**

You give ScopeCheck a code change. It shows every other file in the project that the change touches, marks how serious each one is, and points to the exact lines that prove it.

It doesn't approve or reject anything. It shows you what to look at.

## What you see

- **A verdict** at the top, such as "2 files will break" or "Nothing else is affected."
- **The change** as a short before-and-after diff.
- **A map** with the changed file in the middle and each affected file around it.
- **Proof** for each affected file, showing the real lines from that file with the evidence highlighted.

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

## Try it

There are three ways to try it, from quickest to most real.

**1. Sample pull requests.** These are already loaded when the page opens. Click one in the left sidebar. They use a made-up project called Parcel Help.

**2. A real pull request on GitHub.**
Click **Analyze your code**, choose **GitHub pull request**, and paste one of these links:

| Link | What it changes | What you should see |
| --- | --- | --- |
| [demo-repo PR 1](https://github.com/pdixit0804/demo-repo/pull/1) | Renames a function but only updates one caller | 2 Breaks, 3 Needs update, 2 Check (the best demo) |
| [demo-repo PR 2](https://github.com/pdixit0804/demo-repo/pull/2) | Renames an order status | 1 Breaks, 2 Needs update, 3 Check |
| [demo-repo PR 3](https://github.com/pdixit0804/demo-repo/pull/3) | Raises the free shipping threshold | 2 Needs update, 1 Check |
| [demo-repo PR 4](https://github.com/pdixit0804/demo-repo/pull/4) | Tidies an internal helper | Nothing affected (the safe example) |

Any public pull request works. GitHub allows about 60 requests an hour without signing in, so if it stops loading, wait a bit.

**3. Your own folder.**
Click **Analyze your code**, choose **Upload a folder**, and pick a project folder. Choose a file, edit it right in the browser, then click **Find affected files**. Your files never leave your browser.

## Check the code

From the `scopecheck` folder:

```
npm run lint        # code style
npx tsc --noEmit    # type check
npm run build       # production build
```

All three should finish with no errors. There are no automated tests yet, so the demo PRs above are the main way to check that results look right.

## How it works

ScopeCheck runs entirely in the browser with no server and no API key.

1. **Read the change.** It compares each changed file before and after.
2. **Find what changed.** It collects the names and values that were removed, renamed or edited, plus the function each changed line sits in.
3. **Search the project.** It finds every other file that uses those names, then sorts the results by how serious they are.
4. **Show proof.** Every result quotes real lines from the file. If a quoted line can't be found, ScopeCheck says so instead of guessing.

The main code is in `lib/analyze.ts`. The screen is `app/page.tsx` and the map is `components/ImpactMap.tsx`.

## Limits

ScopeCheck matches names, not meaning. It catches renames, removed values and changed functions well. It can miss a change in behavior that keeps every name the same. The next step is adding AI (Gemini) to explain why a file is affected and suggest how to fix it, while keeping the quoted-line proof.

## More

- [WORKFLOW.md](WORKFLOW.md) explains how we built it.
- `PROJECT_PLAYBOOK.md` and `TEAMMATE_PITCH.md` are the original planning notes.






hi 
