# iSFP-Schnellcheck · CLAUDE.md

## What this is

A single-page React demonstrator for energy renovation planning of German single-family homes (EFH). It generates an **individueller Sanierungsfahrplan (iSFP)** — a BAFA-style staged renovation roadmap — with live energy calculations, cost/subsidy breakdowns, and a printable PDF report.

It is **not** a legally binding BAFA iSFP. It is a credible demonstrator that shows homeowners and advisors what a real iSFP looks like and what the expected savings, costs, and subsidy amounts are for a given building.

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
    App.jsx          — React UI (components, state, render logic)
    data.js          — Data model, measures, presets, calculation engine
    pdfExtract.js    — PDF energy certificate parsing (pdf.js)
    printExport.js   — window.print() export helper
    input.css        — Tailwind source
  build.mjs          — esbuild bundler (JSX → JS, tree-shakes React)
  assemble.mjs       — Inline JS + CSS into dist/index.html
  tailwind.config.js
  dist/
    index.html       — Build output (do not edit directly)

index.html           — Repo root copy, served by GitHub Pages
```

### Build pipeline

```bash
cd build
node build.mjs                                                      # JSX → JS via esbuild
npx tailwindcss -i src/input.css -o dist/tailwind.css --minify     # Tailwind scan + compile
node assemble.mjs                                                   # Inline everything → dist/index.html
cp dist/index.html ../index.html                                    # Deploy copy
```

**Always run all three steps in order.** Skipping `tailwind` loses new utility classes; skipping `assemble` means the root `index.html` is stale.

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

Lower score = better value. Top 3 are tagged **★ Empfohlen** in the UI. Score updates when preset or bauteil sliders change.

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
  empfohleneMassnahmen — top 3 measure IDs by score
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

## Calculation reference (efhNachkrieg, all measures active)

| | IST | ZIEL |
|--|-----|------|
| Primärenergie | 236 kWh/(m²·a) | 78 kWh/(m²·a) |
| Endenergie | 215 | 68 |
| CO₂ | 63 kg/(m²·a) | 19,8 |
| EEK | G | C |
| Heizkosten | 3.429 €/a | 2.761 €/a (WP-Tarif) |
| Investition | 130.800 € | |
| BEG-Förderung | 20.950 € | |
| Eigenanteil | 109.850 € | |

---

## Deployment

GitHub Pages serves `index.html` from the `main` branch root.

```bash
# Push to feature branch → open PR → merge to main → auto-deploy
git push origin <branch>
```

Remote needs PAT in URL (`ghp_…`) — set it once with:
```bash
git remote set-url origin https://johakunath:<PAT>@github.com/johakunath/sanierungsfahrplan.git
```

---

## What's implemented (v3.1)

- **Phase A** — House icon alignment; per-measure cost line simplified to 1 line
- **Phase B** — Per-measure toggles (M4 WP and M5 Fassade independent); state-aware impact functions; bauteile_state derived from sliders
- **Phase C** — `bewerteMassnahmen` scorer; ★ Empfohlen tags on top 3 measures; updates live with preset/slider changes
- **Phase D** — Maßnahmen-Datenbank: collapsible editor for investition and Förderquote per measure; live propagation to all calculations
- **Phase E** — Mobile layout (responsive gutters, scrollable timeline + kumuliert table); Safari/Firefox print clip-path fix

## What's next (planned)

- **Phase F** — Smart auto-deselect: measures that don't make sense for a building (tiny pe_delta < 3 kWh/m²·a) are deselected by default on preset load; "nicht empfohlen" badge for low-value measures; within-package measure sort by score
