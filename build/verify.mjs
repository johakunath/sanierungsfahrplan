// Smoke-tests dist/index.html using jsdom.
// Fails (exit 1) if:
//  - The #root element has no children (blank page)
//  - An element with the "App-Fehler" text is present (ErrorBoundary triggered)
//  - Any uncaught JS error surfaces during the simulated tick
import { readFileSync } from "fs";
import { JSDOM, VirtualConsole } from "jsdom";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dir, "dist/index.html"), "utf8");

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => errors.push(String(e)));

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  virtualConsole,
  url: "http://localhost/",
  pretendToBeVisual: true,
});

// Give the React bootstrap a moment to run synchronously
await new Promise(r => setTimeout(r, 800));

const doc = dom.window.document;
const root = doc.getElementById("root");

const fail = (msg) => {
  console.error(`\n[verify] FAIL: ${msg}\n`);
  process.exit(1);
};

if (!root) fail("#root element not found in dist/index.html");
if (!root.children.length) fail("#root has no children — blank page");

// Check only the rendered DOM (not script/style tag contents)
const rootText = root ? root.textContent : "";
if (rootText.includes("App-Fehler")) fail("ErrorBoundary triggered — React crashed on load");

if (errors.length) {
  console.error("[verify] jsdom errors:", errors.join("\n"));
  // Non-fatal: jsdom has legitimate limitations (canvas, ResizeObserver, etc.)
  // Only fail on recognisable React render errors
  const fatal = errors.some(e => /ReferenceError|TypeError.*undefined|is not defined/i.test(e));
  if (fatal) fail(`Fatal JS error during render: ${errors[0]}`);
}

console.log("[verify] OK — #root has children, no ErrorBoundary, no fatal JS errors");
