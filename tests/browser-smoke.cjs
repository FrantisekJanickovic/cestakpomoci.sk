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
    await page.waitForLoadState("load");
    await page.locator("[data-open-journey]").first().click();
    console.log("PAGE ERRORS:", jsErrors);
    console.log("OPEN:", await page.locator("#journey-dialog").evaluate(el => el.open));
    console.log("SCRIPT:", await page.evaluate(() => ({ appState: typeof state, learningPaths: typeof LEARNING_PATHS, dialog: document.querySelector("#journey-dialog")?.outerHTML.slice(0,150) })));
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
    // Staging admin is intentionally inactive without separate Supabase configuration.
    const adminPage = await browser.newPage();
    const adminErrors = [];
    adminPage.on("pageerror", err => adminErrors.push(err.message));
    await adminPage.goto("http://127.0.0.1:4173/admin.html", { waitUntil:"load" });
    await adminPage.waitForFunction(() => document.querySelector("#status").textContent.includes("není") || document.querySelector("#status").textContent.includes("nie je") || document.querySelector("#status").textContent.includes("nie je nakonfigurovaná") || document.querySelector("#status").textContent.includes("not configured"));
    assert.equal(await adminPage.locator("#login").isHidden(), true);
    assert.equal(await adminPage.locator("#dashboard").isHidden(), true);
    assert.deepEqual(adminErrors, []);
    await adminPage.close();
    console.log("Browser smoke tests passed: questionnaire, navigation, crisis route, learning paths, locked staging admin.");

  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
