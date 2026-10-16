# Oche · PERFECT Practice

A phone-first practice scorer for the PERFECT practical darts exam: 501, open in / double out, split bull (25/50), eight rounds, and one successful leg in five attempts.

## Run

Open `dist/index.html` in a browser, or serve `dist/` with any static web server. No build or dependencies are required.

## Features

- Dark interface designed for phone portrait screens.
- Numeric round-total scoring and individual dart entry.
- Optional checkout and setup suggestions.
- Bust rollback, double-out confirmation and undo.
- Five-attempt mock exams and single-leg practice.
- Browser-local history, separate assisted results and JSON export.

History is stored per browser and website address; it does not sync between devices or migrate automatically from a downloaded HTML file.

## Checks

With Node.js installed:

```sh
node test.cjs
node ui-test.cjs
```

## Hosting

Publish the contents of `dist/` with a static host. `dist/index.html` is the entry point.
