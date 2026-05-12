# iSFP-Schnellcheck · CLAUDE.md

## What this is

A single-page React **demonstrator** for energy renovation planning of German single-family homes (EFH). It generates an **individueller Sanierungsfahrplan (iSFP)** — a BAFA-style staged renovation roadmap — with live energy calculations, cost/subsidy breakdowns, and a printable PDF report.

Not a BAFA-certified iSFP; carries no legal weight. EFH-focused only — do not add MFH support without rethinking the entire energy model.

Eligible building types: Einfamilienhaus (EFH), Zweifamilienhaus (ZFH), Doppelhaushälfte (DHH), Reihenhaus — max ~4 Wohneinheiten.

---

## Architecture

**Single compiled HTML file** — no CDN, no runtime bundler, no server needed.

```
build/
  src/
    App.jsx               — React UI (main state, hooks, render logic) ~2,000 lines
    helpers.jsx           — Shared formatting helpers + EnergyBar component
    data.js               — Data model, measures, presets, calculation engine
    data.test.js          — Vitest unit tests for data.js functions
    pdfExtract.js         — PDF energy certificate parsing (pdf.js)
    printExport.js        — window.print() export helper
    input.css             — Tailwind source + CSS variable tokens
    components/
      ISFPPrintReport.jsx — Print-only iSFP report
      MassnahmenEditor.jsx — Collapsible cost/Förderquote editor
  build.mjs / assemble.mjs / verify.mjs — build pipeline
  dist/index.html         — Build output (do not edit directly)
index.html                — Repo root copy, served by GitHub Pages
```

### Build pipeline

`npm run build` from `build/` runs all 4 steps: `node build.mjs` → Tailwind compile → `node assemble.mjs` → `node verify.mjs` → copies to `../index.html`. Exit non-zero on failure.

Run `npm test` from `build/` after any change to `data.js`.

**Never edit `index.html` (repo root) directly.** Always edit sources in `build/src/`.

### Key components

- **`App.jsx`** — main state + UI; all hooks, package blocks, Ergebnis section
- **`MobileResultsDrawer`** — bottom-sheet for mobile (<768 px); mirrors Ergebnis sidebar
- **`ISFPPrintReport`** — `.print-only` component; stays light (not dark-mode themed)
- **`MassnahmenEditor`** — collapsible per-measure `investition`/`foerderquote` editor

---

## Key concepts

### effectivePakete

`effectivePakete` is a derived memo in App merging user-edited `massnahmenOverrides` into `MASSNAHMENPAKETE`. All downstream calculations and UI use `effectivePakete` — never raw `MASSNAHMENPAKETE` directly. There are exactly 3 intentional exceptions, each marked `// intentional:`.

### bauteile_state

Each building has stufe (1–7) ratings for: `waende`, `dach`, `boden`, `fenster`, `lueftung`, `heizung`, `warmwasser`, `verteilung`. Stufe 1 = unrenovated, Stufe 7 = Passivhaus. Derived via `ableiteBauteile(baujahr, heizung_typ, lueftung, warmwasser)`, manually adjustable.

### bewerteMassnahmen (priority scorer)

`score = invest_netto / pe_saved` [€ per kWh PE saved]. Lower = better value.

- `empfohlen: true` — score < **10.5** (absolute threshold, not relative)
- `nichtEmpfohlen: true` — score > **20.0** or Infinity

BADGE_EXEMPT roles (`pflichtschritt`, `enabler`, `systempfad`, `begleitkosten`) never receive badges.

### State model

```
gebaeude          — building metadata
ist               — current energy state (endenergie, primaerenergie, co2)
bauteile          — array of {id, label, note(1-7)} — editable sliders
aktiveMassnahmen  — active measure IDs e.g. ["M1","M2","M3","M4","M5","M6"]
massnahmenOverrides — {M1: {investition, foerderquote}, …}

Derived (useMemo):
  effectivePakete, bauteile_state, k (ZIEL values), kumuliert, bewertung
```

---

## Presets

| Preset | Year | Heating | IST PE | EEK |
|--------|------|---------|--------|-----|
| efhNachkrieg | 1965 | Heizöl | 236 | G |
| efh70er | 1978 | Erdgas Brennwert | 172 | F |
| efh2000er | 2002 | Erdgas Brennwert | 118 | D |

Applying a preset resets all state. efh70er has `bauteile_overrides: { fenster: 5 }` (windows already replaced).

---

## Calculation reference (efhNachkrieg, all measures active)

| | IST | ZIEL |
|--|-----|------|
| Primärenergie | 236 kWh/(m²·a) | 62 kWh/(m²·a) |
| CO₂ | 63 kg/(m²·a) | 19 kg/(m²·a) |
| EEK | G | B |
| Investition | 142.800 € | |
| BEG-Förderung | 25.950 € (incl. +10 % Klimageschwindigkeitsbonus on M4) | |
| Eigenanteil | 116.850 € | |

Pinned by `data.test.js`. Update both together when changing impact functions, factors, or presets.

### Primary energy and CO₂ factors

Measure impact tables estimate the end-energy delta. Target Primärenergie and CO₂ are then recalculated from the resulting end energy and the active energy carrier:

- `Primärenergie = Endenergie × ENERGIE_TRAEGER_FAKTOREN[carrier].primaerenergie`
- `CO₂ = Endenergie × ENERGIE_TRAEGER_FAKTOREN[carrier].co2KgProKwh`
- Defaults follow GEG Anlage 4 for non-renewable primary energy factors and GEG Anlage 9 for emissions factors.
- Heat pumps and direct electric heating use net electricity defaults: PE factor `1.8`, CO₂ `0.560 kg/kWh`.
- Oil uses PE `1.1`, CO₂ `0.310 kg/kWh`; gas uses PE `1.1`, CO₂ `0.240 kg/kWh`; pellets/wood use PE `0.2`, CO₂ `0.020 kg/kWh`.
- Fernwärme remains a demonstrator fallback because real energy certificates require network-specific factors.

### PV revenue model (`berechnePvErtrag` in data.js)

Constants (all exported from `data.js`):

| Constant | Value | Note |
|----------|-------|------|
| `PV_KWP` | 10 | kWp system size assumed |
| `PV_SPEZ_ERTRAG` | 950 | kWh/kWp/year, average German site |
| `STROMPREIS_HAUSHALT` | 0.31 | €/kWh household tariff 2026 |
| `EINSPEISETARIF` | 0.082 | €/kWh EEG 2024, <10 kWp |
| `PV_EV_QUOTE_OHNE_WP` | 0.35 | self-consumption share without WP |
| `PV_EV_QUOTE_MIT_WP` | 0.60 | self-consumption share with WP + Speicher |

`berechnePvErtrag(mitWP)` returns `{ gesamtEur, evEur, einsEur }`. Called in M6 cost line (PaketBlock) with `mitWP = aktiveMassnahmen.includes("M4")`.

Expected outputs: ~1.330 €/year without WP (amortisation ~14 J), ~2.020 €/year with WP (amortisation ~9 J).

### Amortisation model

- **Sidebar/Drawer KPI**: `Eigenanteil ÷ (IST-Heizkosten − ZIEL-Heizkosten)` at static prices. Only shown when `heizkosten > k.heizkosten_gesamt`.
- **20-Jahr-Bilanz** (Ergebnis section): `ohneEur = heizkosten × 20`, `mitEur = k.eigenanteil + k.heizkosten_gesamt × 20`. Static prices, no escalation.

---

## Deployment

GitHub Pages serves `index.html` from the `main` branch root.

```bash
# The proxy port changes each session — look it up:
PROXY_PORT=$(git -C /home/user/iSFP-Schnellcheck remote get-url origin | grep -oP ':\K\d+(?=/)')
git remote set-url origin http://local_proxy@127.0.0.1:${PROXY_PORT}/git/johakunath/iSFP-Schnellcheck
git push -u origin <branch>
```

**MCP `push_files` as fallback**: For individual files ≤~50 KB. Avoid for large files (index.html ~295 KB, package-lock.json ~106 KB) — use `git push`.

---

## Known failure patterns (do not repeat)

### Variable naming in `.map()` callbacks
Never use `p` as a loop variable when `p` is already in outer scope. The `p is not defined` crash (PRs #27–#32) came from `MASSNAHMENPAKETE.map(p => …)`. Use descriptive names: `pak`, `paket`, `pkg`.

### Missing `?? 0` on optional number fields
`m.ohnehin_anteil`, `m.foerderquote`, `m.investition` can be undefined. Always write `m.ohnehin_anteil ?? 0`.

### effectivePakete vs MASSNAHMENPAKETE
All cost/subsidy display must use `effectivePakete`. If you see an unmarked `MASSNAHMENPAKETE` reference in a cost context, it is a bug.

### Git signing server
When `git commit` fails with signing error, use git plumbing:
```bash
TREE=$(git write-tree)
COMMIT=$(git commit-tree $TREE -p HEAD -m "message")
git update-ref refs/heads/<branch> $COMMIT
```

### Auth proxy port changes each session
```bash
PROXY_PORT=$(git -C /home/user/iSFP-Schnellcheck remote get-url origin | grep -oP ':\K\d+(?=/)')
git remote set-url origin http://local_proxy@127.0.0.1:${PROXY_PORT}/git/johakunath/iSFP-Schnellcheck
```

---

## Permanent maintenance rules

After every task, verify the following invariants are still satisfied:

| Invariant | How to check |
|-----------|-------------|
| **Golden values** | `npm test` must pass. If PE/EEK/Eigenanteil shift, update `data.test.js` AND this file AND `AGENTS.md` together. |
| **Offline guarantee** | `npm run build && npm test` must pass including the CDN-check in `verify.mjs`. No `googleapis.com`, `gstatic.com`, `cdnjs.cloudflare.com`, or `unpkg.com` references allowed in `dist/index.html`. |
| **Print/live consistency** | `ISFPPrintReport` must receive `dynamicPakete` (not `effectivePakete`). If M1→P3 logic in App.jsx changes, update the prop passed to `ISFPPrintReport`. |
| **Recommendation logic** | `massnahmeIstSchonVorhanden` gates M4 and M6. Any new "already-present" check must update both `data.js` and the `updateGebaeude`/`applyPreset` callers in `App.jsx`. |
| **PDF confirmation** | PDF extraction must never mutate state without user confirmation (`pendingExtraction` → review UI → `applyPendingExtraction`). Do not shortcut this flow. |

---

## Technical debt (known simplifications)

| Area | Simplification |
|------|---------------|
| Subsidy amounts | Fixed Förderquoten; no income test, no Förderdeckel, no bonus-combination rules |
| Wohnfläche | Heuristic GNF / 1.3 when not from PDF |
| WP COP | Wärmeverteilung affects WP impact through variant multipliers and flow-temperature malus, but no full hourly COP model |
| CO₂ values | Target CO₂ is factor-based from Endenergie and carrier; per-measure CO₂ labels are still static hints |
| Multi-WE | Treats ZFH/DHH/RH identically to EFH |
| Amortisation | Static energy prices only; no real energy price escalation (typically 2–3 %/year) |
| PV revenue | Fixed 10 kWp assumed; no shading, orientation, or roof-area checks |
| PV EV quote | Fixed 35 %/60 % split; real value depends on household consumption profile |
