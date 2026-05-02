# iSFP-Schnellcheck · CLAUDE.md

## What this is

A single-page React **demonstrator** for energy renovation planning of German single-family homes (EFH). It generates an **individueller Sanierungsfahrplan (iSFP)** — a BAFA-style staged renovation roadmap — with live energy calculations, cost/subsidy breakdowns, and a printable PDF report.

It is **not** a BAFA-certified iSFP and carries no legal weight. It is a credible demonstrator that shows homeowners and advisors what a real iSFP looks like and what the expected savings, costs, and subsidy amounts are for a given building.

---

## Product boundaries

- **Supported building types**: Einfamilienhaus (EFH), Zweifamilienhaus (ZFH), Doppelhaushälfte (DHH), Reihenhaus — max ~4 Wohneinheiten.
- **Not supported**: Mehrfamilienhaus (MFH), commercial buildings, historic listed buildings (Denkmalschutz) beyond a simple flag.
- The pdfExtract regex, Gebäudetyp dropdown, and all energy presets are scoped to EFH only. Do not add MFH support without rethinking the entire energy model.

---

## Background: what is an iSFP?

The **individueller Sanierungsfahrplan** is a BAFA program that funds a professional energy consultant to create a multi-step renovation roadmap for a building. Homeowners who follow an iSFP receive an additional **5 % BEG iSFP-Bonus** on top of the base BEG EM (Bundesförderung für effiziente Gebäude — Einzelmaßnahmen) subsidy for each renovation step.

Key German regulatory context:
- **BEG EM** (BAFA): 15 % base grant for individual energy measures (insulation, windows, heating)
- **BEG HZG / KfW 458**: Up to 50 % for heat pump replacement (Heizungstausch)
- **iSFP-Bonus**: +5 % on top of base rate, capped at 50 % total
- **GEG §71** (ab 2026): mandatory renewable heating at point of replacement
- Basis for EEK (Energieeffizienzklasse): **Primärenergie** in kWh/(m²·a) — not Endenergie

---

## Architecture

**Single compiled HTML file** — no CDN, no runtime bundler, no server needed. The entire app ships as one `index.html` (~248 KB) that works offline.

```
build/
  src/
    App.jsx               — React UI (main state, hooks, render logic) ~1,850 lines
    helpers.jsx           — Shared formatting helpers + EnergyBar component
    data.js               — Data model, measures, presets, calculation engine
    data.test.js          — Vitest unit tests for data.js functions
    pdfExtract.js         — PDF energy certificate parsing (pdf.js)
    printExport.js        — window.print() export helper
    input.css             — Tailwind source
    components/
      ISFPPrintReport.jsx — Print-only iSFP report (Seite 1 Überblick + detail pages per package)
      MassnahmenEditor.jsx — Collapsible cost/Förderquote editor (Maßnahmen-Datenbank)
  build.mjs               — esbuild bundler (JSX → JS, tree-shakes React)
  assemble.mjs            — Inline JS + CSS into dist/index.html
  verify.mjs              — jsdom smoke test run after every build
  tailwind.config.js
  dist/
    index.html            — Build output (do not edit directly)

index.html                — Repo root copy, served by GitHub Pages
```

### Build pipeline

```bash
cd build
node build.mjs                                                      # JSX → JS via esbuild
npx tailwindcss -i src/input.css -o dist/tailwind.css --minify     # Tailwind scan + compile
node assemble.mjs                                                   # Inline everything → dist/index.html
node verify.mjs                                                     # Smoke test (auto-run by npm run build)
cp dist/index.html ../index.html                                    # Deploy copy
```

Use `npm run build` from `build/` — it runs all four steps in order and exits non-zero on failure.

Run `npm test` from `build/` after any change to `data.js` to verify calculation correctness.

**Always run all steps in order.** Skipping `tailwind` loses new utility classes; skipping `assemble` means the root `index.html` is stale.

### Key components

**`ErrorBoundary`** (`App.jsx`, exported class) — wraps the entire app. Catches any render-time exception and displays the error message instead of a blank page. Added after the `p is not defined` family of bugs made blank-page failures invisible.

**`MobileResultsDrawer`** (`App.jsx`) — bottom-sheet overlay for mobile viewports (<768 px). Shows the Ergebnis panel (EEK badge, cost summary, EEK chart) as a slide-up drawer triggered by a sticky footer button. Desktop layout shows the panel inline in the right column; the drawer is hidden on desktop via CSS.

**`ISFPPrintReport`** (`components/ISFPPrintReport.jsx`) — print-only component (`.print-only` CSS class). Renders Seite 1 Überblick (IST/ZIEL boxes, cascade summary) plus one detail page per active package. Uses `EnergyBar` and formatting helpers from `helpers.jsx`.

**`MassnahmenEditor`** (`components/MassnahmenEditor.jsx`) — collapsible table that lets users override per-measure `investition` and `foerderquote`. Changes are stored in `massnahmenOverrides` state and merged into `effectivePakete`. Uses raw `MASSNAHMENPAKETE` (pre-override base values) — this is intentional.

---

## Key concepts

### Measures (M1–M6)

Six renovation measures, each belonging to a package:

| ID | Measure | Package | Component |
|----|---------|---------|-----------|
| M1 | Hydraulischer Abgleich + Heizungsoptimierung | P1 Sofortmaßnahmen | heizung |
| M2 | Dachdämmung OG-Decke (22 cm Mineralwolle) | P2 Hülle & Fenster | dach |
| M3 | Fenstertausch (3-fach, Uw ≤ 0,95) | P2 Hülle & Fenster | fenster |
| M4 | Luft-Wasser-Wärmepumpe (12 kW, monovalent) | P3 Wärmeerzeugung & Fassade | heizung |
| M5 | Fassadendämmung (WDVS 18 cm Mineralwolle) | P3 Wärmeerzeugung & Fassade | waende |
| M6 | PV-Anlage (10 kWp) + 8 kWh Speicher | P4 Eigenstrom | — |

Package order reflects **iSFP physical logic**: hydraulic balancing before envelope, envelope before heating system, heating before PV. This order is intentional and must not be reversed.

### bauteile_state

Each building has a `bauteile_state` object with stufe (1–7) ratings for:
`waende`, `dach`, `boden`, `fenster`, `lueftung`, `heizung`, `warmwasser`, `verteilung`

**Stufe 1** = unrenovated/old, **Stufe 7** = Passivhaus standard. Derived automatically from `ableiteBauteile(baujahr, heizung_typ, lueftung, warmwasser)` based on TABULA building age classes, and manually adjustable via sliders.

### State-aware impact functions

Each measure has an `impact(bauteile_state)` function (not a static value). Energy savings depend on how bad the current component is:

```js
// M2 Dachdämmung: saves 26 kWh/m²·a PE if roof is uninsulated (stufe 2),
// but only 1 kWh/m²·a if already well-insulated (stufe 6)
impact: bs => _imp([[-26,-31,5.0],[-22,-26,4.2],...,[-1,-1,0.1],[0,0,0]], bs.dach)
```

This means the Ergebnis/EEK projection changes automatically when component sliders are adjusted — a 2000er building correctly shows smaller savings than a 1965 building.

### bewerteMassnahmen (priority scorer)

`bewerteMassnahmen(massnahmen, bauteile_state, gebaeude)` in `data.js` ranks measures by:

```
score = invest_netto / pe_saved   [€ per MWh primary energy saved]
```

Lower score = better value. The function returns each measure with two derived flags:

- `empfohlen: true` — score < **0.75 × median** of all finite scores (clearly cheaper per MWh than average)
- `nichtEmpfohlen: true` — score > **2.0 × median**, or infinite (clearly more expensive, or no PE savings)

Measures in between carry no badge. This scales automatically with any number of active measures; no fixed count like "top 3". Score updates whenever preset, bauteil sliders, or massnahmenOverrides change.

**Note**: This is a single-metric ranking (€/MWh PE). It does not factor in comfort, CO₂, subsidy urgency, or legal deadlines (GEG §71). Advisors should communicate this to clients.

### Wärmeverteilung + WP-Typ recommendation

`vorlauftemperaturFuer(typ)` maps the `gebaeude.waermeverteilung` option to a Vorlauftemperatur:

| Wärmeverteilung | Vorlauftemperatur |
|---|---|
| Heizkörper (Hochtemperatur, >60 °C) | 65 °C |
| Heizkörper (Niedertemperatur, 45–55 °C) | 50 °C |
| gemischt (Heizkörper + Fußboden) | 45 °C |
| Fußbodenheizung (<40 °C) | 35 °C |

`wpTypEmpfehlung(vorlaufTemp, envAvg)` returns `{ typ, note }` based on Vorlauftemperatur and envelope quality (average of `waende` + `dach` bauteil stufe):

- ≤ 40 °C + envAvg ≥ 4 → **Monovalent** (ideal, floor heating + good envelope)
- ≤ 50 °C + envAvg ≥ 3 → **Monovalent / Monoenergetic**
- ≤ 55 °C → **Monoenergetic** (WP covers ~95 % of load, electric backup for peaks)
- > 55 °C → **Bivalent / Hybrid** (COP ~2, envelope or heating circuit upgrade recommended first)

This is shown as a live readout inside the M4 (Wärmepumpe) PaketBlock. It is **informational only** — it does not feed back into energy calculations (WP PE savings already apply an envelope-quality malus via the impact function).

### effectivePakete

`effectivePakete` is a derived memo in App that merges user-edited `massnahmenOverrides` into MASSNAHMENPAKETE. All downstream calculations (berechneNachMassnahmen, berechneKumuliert, bewerteMassnahmen, PaketBlock display, Ergebnis cost table, ISFPPrintReport) use `effectivePakete` — never the raw `MASSNAHMENPAKETE` directly.

---

## State model (App.jsx)

```
gebaeude          — building metadata (strasse, baujahr, typ, heizung_typ, …)
ist               — current energy state (endenergie, primaerenergie, co2)
bauteile          — array of {id, label, note(1-7), info} — derived from gebaeude, manually editable
aktiveMassnahmen  — array of active measure IDs e.g. ["M1","M2","M3","M4","M5","M6"]
massnahmenOverrides — object {M1: {investition, foerderquote}, …} from Maßnahmen-Datenbank editor

Derived (useMemo):
  bauteile_state     — {waende, dach, …} map from bauteile array
  effectivePakete    — MASSNAHMENPAKETE with overrides merged in
  aktivePakete       — package IDs where ≥1 measure is active
  gebaeudeWithState  — gebaeude + bauteile_state
  k                  — berechneNachMassnahmen result (ZIEL values)
  kumuliert          — berechneKumuliert result (step-by-step table)
  bewertung              — sorted array of {id, score, empfohlen, nichtEmpfohlen} from bewerteMassnahmen
  empfohleneMassnahmen   — IDs where empfohlen === true (score < 0.75 × median)
  nichtEmpfohleneMassnahmen — IDs where nichtEmpfohlen === true (score > 2× median or Infinity)
```

---

## Presets

Three built-in presets load realistic starting points:

| Preset | Year | Heating | IST PE | EEK |
|--------|------|---------|--------|-----|
| efhNachkrieg | 1965 | Heizöl | 236 | G |
| efh70er | 1978 | Erdgas Brennwert | 172 | F |
| efh2000er | 2002 | Erdgas Brennwert | 118 | D |

Applying a preset resets all state (gebaeude, ist, bauteile, aktiveMassnahmen, massnahmenOverrides).

---

## Calculation reference (efhNachkrieg, all measures active — M1–M7)

These are the values `berechneNachMassnahmen` must produce for the efhNachkrieg preset with all measures active. They are pinned by `data.test.js`; if you change an impact function or preset, the test will break — update both together.

| | IST | ZIEL |
|--|-----|------|
| Primärenergie | 236 kWh/(m²·a) | 86 kWh/(m²·a) |
| EEK | G | C |
| Investition | 142.800 € | |
| BEG-Förderung | 23.250 € | |
| Eigenanteil | 119.550 € | |

---

## Deployment

GitHub Pages serves `index.html` from the `main` branch root.

```bash
# Push to feature branch → open PR → merge to main → auto-deploy
git push -u origin <branch>
```

### Git push in Claude Code sessions

The repo at `/home/user/isfp` uses a bare HTTPS remote by default. Pushes will fail with "No such device or address". Fix by switching to the local auth proxy (already configured in `/home/user/iSFP-Schnellcheck`):

```bash
git remote set-url origin http://local_proxy@127.0.0.1:42055/git/johakunath/iSFP-Schnellcheck
git push -u origin <branch>
```

The proxy at `127.0.0.1:42055` handles GitHub auth transparently — no PAT needed. This only works inside Claude Code web sessions; for local dev, use a PAT in the URL instead:

```bash
git remote set-url origin https://johakunath:<PAT>@github.com/johakunath/iSFP-Schnellcheck.git
```

**MCP `push_files` as fallback**: For individual files ≤~50 KB, `mcp__github__push_files` works without git credentials. Avoid it for large files (index.html ~295 KB, package-lock.json ~106 KB) — those must go via `git push`.

---

## Build rules

- **Never edit `index.html` (repo root) directly.** It is overwritten by `npm run build`. Edit source files in `build/src/` only.
- Run `npm run build` from `build/` after any change to `App.jsx`, `helpers.jsx`, `data.js`, `pdfExtract.js`, `printExport.js`, `input.css`, or any file under `components/`.
- Run `npm test` from `build/` after any change to `data.js` to verify calculation correctness.
- The full build script: `node build.mjs && npx tailwindcss -i src/input.css -o dist/tailwind.css --minify && node assemble.mjs && node verify.mjs && cp dist/index.html ../index.html`

---

## Subsidy disclaimer (in-app wording)

The following disclaimer appears at the bottom of the Fahrplan section (print-hide):

> Förderwerte sind vereinfachte Demo-Annahmen. Keine Förderzusage. Förderdeckel, Bonuskombinationen, Eigentümerstatus und Antragspflichten müssen im echten Prozess geprüft werden.

Do not remove this or weaken the wording. It is a legal/trust safeguard.

---

## Technical debt (known simplifications)

| Area | Simplification |
|------|---------------|
| Subsidy amounts | Fixed Förderquoten per measure; no income test, no Förderdeckel (z.B. BEG max. 60.000 € förderfähige Kosten), no bonus-combination rules |
| Wohnfläche | Heuristic: GNF / 1.3 when not from PDF; real buildings vary significantly |
| WP COP | Wärmeverteilung is informational only; WP savings use a fixed PE factor + envelope malus, not a COP model |
| CO₂ values | Per-measure CO₂ reductions are static estimates, not calculated from energy delta + carrier emission factor |
| Multi-WE | Treats ZFH/DHH/RH identically to EFH; Wohneinheiten count has no effect on energy calculation |

---

## What's implemented (v3.2)

- **Phase A** — House icon; per-measure cost line
- **Phase B** — Per-measure toggles; state-aware impact functions; bauteile_state from sliders
- **Phase C** — `bewerteMassnahmen` scorer; ★ Empfohlen tags; live updates
- **Phase D** — Maßnahmen-Datenbank: collapsible cost/Förderquote editor per measure
- **Phase E** — Mobile layout; Safari/Firefox print fix
- **Phase F–H** — (intermediate phases)
- **Phase I** — PDF Energieausweis import (pdfExtract.js); print export; EnergieVerlaufChart
- **Phase J** — Ratio-to-median recommendation thresholds (replaces "top 3"); Wärmeverteilung model + WP-Typ recommendation in M4; subsidy disclaimer; legacy cleanup (removed babel/html2canvas/jspdf/jsdom deps; HouseIcon rename; EFH-only regex)

## What's next

- **Vorlauftemperatur → WP COP linkage**: Wire `vorlauftemperaturFuer()` into the WP PE savings calculation (M4 impact function) so high-temp radiator buildings correctly show lower WP savings — currently the envelope malus proxies for this but doesn't account for the heating circuit directly.
- **Preset Wärmeverteilung auto-suggest**: When user selects Heizung = Wärmepumpe, suggest switching to Fußbodenheizung if current distribution is Hochtemperatur.
- **Multi-step Förderdeckel**: Enforce BEG per-measure caps (60.000 € förderfähige Kosten) and correctly limit the iSFP-Bonus stacking.

---

## Agent quickstart (for Claude/Codex, token-saving)

Use this minimal path before deep analysis:

1. Read only these sections first:
   - **What this is**
   - **Product boundaries**
   - **Architecture**
   - **Build rules**
2. Open only the file needed for your task:
   - UI/state issues → `build/src/App.jsx`
   - energy/subsidy math → `build/src/data.js`
   - PDF import/parsing → `build/src/pdfExtract.js`
   - print/export behavior → `build/src/printExport.js`
   - styling issues → `build/src/input.css`
3. For quick regression checks after logic changes:
   - Validate package/measure order remains physically plausible (P1→P4, M1→M6).
   - Compare one known output against the **Calculation reference** table.
4. Build only when required:
   - Source edits in `build/src/*` require `npm run build` from `build/`.
   - Doc-only edits do not.

### High-signal facts to avoid re-deriving

- Root `index.html` is generated output; edit sources only.
- `effectivePakete` is the canonical dataset for downstream calculations/UI.
- Recommendation badges are median-relative (`0.75×` and `2.0×` thresholds), not fixed top-N.
- This is an EFH-focused demonstrator, not a BAFA-certified planning artifact.
