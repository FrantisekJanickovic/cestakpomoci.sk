const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

(async () => {
  const server = spawn("python3", ["-m", "http.server", "4173", "--bind", "127.0.0.1"], { stdio: "ignore" });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    const jsErrors = [];
    page.on("pageerror", error => jsErrors.push(error.message));
    let loaded = false;
    for (let attempt = 0; attempt < 25 && !loaded; attempt++) {
      try { await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded", timeout: 4000 }); loaded = true; }
      catch { await new Promise(resolve => setTimeout(resolve, 200)); }
    }
    assert.ok(loaded, "local server failed to start");
    await page.locator("[data-open-journey]").first().click();
    assert.equal(await page.locator("#journey-dialog").evaluate(el => el.open), true, "questionnaire did not open");
    assert.match(await page.locator("#journey-content").innerText(), /bezprostrednom ohrození/);
    await page.locator('[data-journey-value="information"]').click();
    assert.match(await page.locator("#journey-content").innerText(), /Koľko má dieťa rokov/);
    await page.locator("#journey-back").click();
    assert.match(await page.locator("#journey-content").innerText(), /bezprostrednom ohrození/);
    await page.locator('[data-journey-value="immediate"]').click();
    assert.match(await page.locator("#journey-content").innerText(), /112/);
    await page.locator("#journey-dialog").evaluate(el => el.close());
    const cards = page.locator("#learning-path-list [data-learning-slug]");
    assert.equal(await cards.count(), 6, "learning routes failed to render");
    await cards.first().click();
    assert.match(await page.locator("#journey-content").innerText(), /Úzkosť/);
    const firstStep = page.locator('[data-learning-step="0"]');
    await firstStep.check();
    assert.equal(await page.locator('[data-learning-step="0"]').isChecked(), true);
    assert.deepEqual(jsErrors, [], "JavaScript exceptions: " + jsErrors.join("; "));
    console.log("Browser smoke tests passed: questionnaire, navigation, crisis route, six learning paths, progress.");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
