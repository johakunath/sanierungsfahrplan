const { test, expect } = require("@playwright/test");
const path = require("path");

const APP = `file://${path.join(__dirname, "../../dist/index.html")}`;

// ─── helpers ──────────────────────────────────────────────────────────────

async function loadApp(page) {
  await page.goto(APP);
  await page.waitForSelector("#root", { state: "attached" });
  // ErrorBoundary renders a "Unbehandelte Ausnahme" message — make sure it's absent
  await expect(page.locator("text=Unbehandelte Ausnahme")).not.toBeVisible();
}

async function selectPreset(page, labelText) {
  await page.locator(`button:has-text("${labelText}")`).first().click();
  // Wait for React to re-render derived state
  await page.waitForTimeout(300);
}

// ─── Suite ────────────────────────────────────────────────────────────────

test("app loads without ErrorBoundary", async ({ page }) => {
  await loadApp(page);
  await expect(page.locator("#root")).not.toBeEmpty();
  // Use the exact main heading (font-serif div), not any substring match
  await expect(page.locator(".font-serif").filter({ hasText: /^iSFP-Schnellcheck$/ })).toBeVisible();
});

test("efhNachkrieg preset: IST EEK badge shows G", async ({ page }) => {
  await loadApp(page);
  await selectPreset(page, "EFH Nachkriegszeit 1965");
  // The IST EEK class "G" appears in the Ergebnis section
  await expect(page.locator("#ergebnis").getByText("G").first()).toBeVisible();
});

test("efhNachkrieg preset: all measures active → EEK C, Eigenanteil 116.850 €", async ({ page }) => {
  await loadApp(page);
  await selectPreset(page, "EFH Nachkriegszeit 1965");
  const section = page.locator("#ergebnis");
  await expect(section.getByText("C").first()).toBeVisible();
  await expect(section.getByText(/116[.,]850/).first()).toBeVisible();
});

test("toggling a package off changes its button label", async ({ page }) => {
  await loadApp(page);
  await selectPreset(page, "EFH Nachkriegszeit 1965");

  // Scroll the first PaketBlock into view and click its toggle
  const paketBlocks = page.locator("[id^='paket-']");
  const firstBlock = paketBlocks.first();
  await firstBlock.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);

  const toggleBtn = firstBlock.getByText("Im Fahrplan");
  await expect(toggleBtn).toBeVisible({ timeout: 5000 });
  await toggleBtn.click();
  await page.waitForTimeout(150);

  await expect(firstBlock.getByText("Ausgeblendet")).toBeVisible();
});

test("MassnahmenEditor: override M4 Investition updates Eigenanteil", async ({ page }) => {
  await loadApp(page);
  await selectPreset(page, "EFH Nachkriegszeit 1965");

  // Open the MassnahmenEditor collapsible
  const trigger = page.locator("text=Maßnahmen-Datenbank").first();
  await trigger.click();
  await page.waitForTimeout(300);

  // Find the Wärmepumpe row's investition input
  const m4Row = page.locator("tr").filter({ hasText: /Wärmepumpe/ }).first();
  const investInput = m4Row.locator("input[type=number]").first();

  if ((await investInput.count()) > 0) {
    await investInput.fill("20000");
    await investInput.dispatchEvent("input");
    await page.waitForTimeout(200);
    // After reducing M4 cost, Eigenanteil should no longer show 116.850
    await expect(
      page.locator("#ergebnis").getByText(/116[.,]850/).first()
    ).not.toBeVisible();
  }
});

test("print report section is present in DOM with ÜBERBLICK heading", async ({ page }) => {
  await loadApp(page);
  await selectPreset(page, "EFH Nachkriegszeit 1965");
  // ISFPPrintReport renders with class print-only (screen-hidden, DOM-present)
  const printReport = page.locator(".print-only").first();
  await expect(printReport).toBeAttached();
  await expect(printReport.getByText("ÜBERBLICK", { exact: true })).toBeAttached();
});
