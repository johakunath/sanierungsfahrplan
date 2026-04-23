import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const react = readFileSync('node_modules/react/umd/react.production.min.js', 'utf8');
const reactDom = readFileSync('node_modules/react-dom/umd/react-dom.production.min.js', 'utf8');
const tailwind = readFileSync('dist/tailwind.css', 'utf8');
const app = readFileSync('dist/app.js', 'utf8');

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>iSFP-Schnellcheck — Demonstrator EFH</title>
<meta name="description" content="Demonstrator für einen individuellen Sanierungsfahrplan auf Basis des BEG 2026 und TABULA-Methodik.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
${tailwind}

/* ── Palette & fonts ──────────────────────────────────────────────── */
:root {
  --paper: #F8F5EF; --paper-2: #F1EDE4;
  --ink: #1E1A15; --ink-2: #3A332B; --muted: #6B6259;
  --line: #E2DBD0; --line-2: #D3CAB9;
  --accent: #B5623E; --accent-2: #8F4727;
  --isfp-green: #00843D;
}
html, body {
  background: var(--paper); color: var(--ink);
  font-family: 'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body { font-feature-settings: 'ss01', 'cv11'; }
* { box-sizing: border-box; }

.font-serif { font-family: 'Fraunces', Georgia, serif; }
.font-sans { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
.font-mono { font-family: 'Geist Mono', ui-monospace, monospace; }

table td, table th { vertical-align: baseline; }

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #D3CAB9; border-radius: 10px; border: 2px solid #F8F5EF; }
::-webkit-scrollbar-thumb:hover { background: #B5623E; }

button:focus-visible { outline: 2px solid #B5623E; outline-offset: 2px; }

/* ── PRINT-ONLY elements (hidden by default) ──────────────────────── */
.print-only { display: none; }

/* ── PRINT CSS ────────────────────────────────────────────────────── */
@media print {
  @page {
    size: A4 portrait;
    margin: 10mm 12mm;
  }
  html, body {
    background: #FFFFFF !important;
    font-size: 11pt !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body * {
    color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }

  /* Hide all interactive/navigational UI */
  .print-hide,
  header,
  footer,
  button,
  input[type="range"],
  #presets {
    display: none !important;
  }

  /* Show print-only elements */
  .print-only {
    display: block !important;
  }

  /* Remove sticky positioning */
  [style*="sticky"] {
    position: static !important;
  }

  /* Remove backdrops, blurs, animations */
  * {
    animation: none !important;
    transition: none !important;
    backdrop-filter: none !important;
  }

  /* Main container: full width */
  main {
    max-width: none !important;
    padding: 0 !important;
  }

  /* Sections: page breaks */
  section {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 20px !important;
  }

  /* Force section titles on new page starting from Fahrplan */
  #fahrplan, #ergebnis {
    page-break-before: auto;
  }

  /* Cards: no shadows */
  div[style*="box-shadow"] {
    box-shadow: none !important;
  }

  /* Inputs: display as static values */
  input, select {
    border: none !important;
    background: transparent !important;
    -webkit-appearance: none !important;
    appearance: none !important;
  }
  select {
    background-image: none !important;
    padding-right: 8px !important;
  }

  /* Tooltips hidden */
  [style*="pointer-events: none"] {
    display: none !important;
  }

  /* Paket-Blocks: keep together */
  .paket-block { page-break-inside: avoid; }
}
</style>
</head>
<body>
<div id="root"></div>
<script>${react}</script>
<script>${reactDom}</script>
<script>${app}</script>
</body>
</html>`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('React:    ', kb(react.length));
console.log('ReactDOM: ', kb(reactDom.length));
console.log('Tailwind: ', kb(tailwind.length));
console.log('App:      ', kb(app.length));
console.log('Total:    ', kb(html.length));
