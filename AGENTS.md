# iSFP-Schnellcheck · AGENTS.md

Quick-start for AI coding agents. Read CLAUDE.md for full domain context.

## Project type

Single-page React app bundled to one `index.html`. No server, no CDN, no runtime deps.

## Source files

```
build/src/
  App.jsx               — main UI, state, hooks (~1,850 lines)
  helpers.jsx           — fmt/fmtEur/textColorFor/waermeEEK/EnergyBar
  data.js               — calculation engine (pure functions, no React)
  data.test.js          — Vitest unit tests for data.js
  components/
    ISFPPrintReport.jsx — print-only report pages
    MassnahmenEditor.jsx— cost/Förderquote editor table
```

## Dev workflow

```bash
cd build
npm run build   # build + smoke test + copy dist/index.html → ../index.html
npm test        # Vitest unit tests (run after any change to data.js)
```

Run `npm run build` after every change that touches source files. Run `npm test` after any change to `data.js` — the tests pin exact PE/EEK/Eigenanteil values for efhNachkrieg.

## Change safety rules

1. **Never edit the root `index.html` directly** — it is overwritten by every build.
2. **effectivePakete rule**: all downstream calculations use `effectivePakete` (the override-merged memo in App.jsx). The three `MASSNAHMENPAKETE` direct usages in App.jsx carry `// intentional:` comments — do not "fix" them.
3. **Calculation reference**: `berechneNachMassnahmen(allIds, efhNachkrieg)` must produce PE=86, EEK=C, Eigenanteil=119,550. If your change shifts these, update `data.test.js` and CLAUDE.md together.
4. **One build per PR**: verify `npm run build && npm test` both pass before pushing.
5. **German naming is intentional**: `bauteile_state`, `effectivePakete`, `bewerteMassnahmen`, etc. Keep it consistent.

## Domain summary

Renovation measures M1–M7 are grouped in packages P1–P4. Each measure has a state-aware `impact(bauteile_state)` function. `effectivePakete` merges user cost overrides from `massnahmenOverrides` into the base `MASSNAHMENPAKETE`. See CLAUDE.md for full EEK, BEG subsidy, and TABULA building-age logic.
