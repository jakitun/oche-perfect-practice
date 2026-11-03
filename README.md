# OCHE

A mobile darts practice app with three practice modes and one shared interface.
The PERFECT mode uses the existing scoring engine.

- **PERFECT 501** — 501 split bull, open in and double out, eight rounds, one clear in five attempts. Includes single-leg practice, round and dart entry, undo, and optional hints.
- **Bull & Mark** — alternate 2 bulls and 5 marks from 20 through 15, then finish with 2 bulls. Tap once per finished phase to record the split.
- **Bull Race** — log 0–3 bulls per visit and race to a configurable target.

All modes write new sessions to one browser-local history. History and
Insights also read the original save formats. Existing PERFECT and Free-Oche saves on the same Pages origin
remain available. Bull & Mark sessions saved on the ChatGPT Sites origin stay
with that origin. Settings can download the unified history as JSON.

## Run and publish

Serve this repository with a static HTTP server and open its root. There is no
build step. GitHub Pages can serve the repository root on the existing branch.
The root forwards to `dist/`, which can also be deployed directly.

## Checks

Run `node test.cjs` and `node ui-test.cjs` to exercise the PERFECT engine and UI.
