# AGENTS.md

## Purpose
This file provides quick-start guidance for coding agents and contributors working in this repository.

## Read order (important)
1. Read this `AGENTS.md` for execution rules and token-saving workflow.
2. Read `CLAUDE.md` for full product context.

`CLAUDE.md` remains the main documentation, how-to guide, and README-style source of truth.

## Fast project context
- App type: single-page React demonstrator for German iSFP renovation roadmaps.
- Build model: generated single-file `index.html` from sources under `build/src/`.
- Critical rule: never hand-edit root `index.html`; rebuild from `build/`.

## Agent workflow (token-efficient)
- Start with targeted reads only:
  - `CLAUDE.md` sections: **What this is**, **Architecture**, **Build rules**.
  - Then open only the source file you need (`build/src/App.jsx`, `data.js`, `pdfExtract.js`, etc.).
- Avoid broad scans and full-file dumps unless debugging unknown behavior.
- Summarize findings in short bullets before editing; patch the smallest viable scope.
- After code changes in `build/src/`, run `npm run build` in `build/` to refresh root `index.html`.

## Change safety checklist
- Preserve package ordering logic (P1 → P4) and measure IDs (M1–M6).
- Keep legal/subsidy disclaimer wording intact unless explicitly requested.
- If calculation logic changes, sanity-check one known reference scenario from `CLAUDE.md`.
