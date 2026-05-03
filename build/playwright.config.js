const { defineConfig } = require("@playwright/test");
const path = require("path");

const appUrl = `file://${path.join(__dirname, "dist", "index.html")}`;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 15000,
  retries: 0,
  use: {
    headless: true,
    browserName: "chromium",
  },
  snapshotDir: "./tests/e2e/snapshots",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
});
