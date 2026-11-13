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
    // Multilingual catalogue controls must exist and actually filter results.
    await page.route("**/api/resources",route=>route.fulfill({
      status:200,contentType:"application/json",
      body:JSON.stringify([
       {title:"Slovenský zdroj",owner_name:"SK",topics:[],audience:[],age_groups:[],
        source_url:"https://example.org/sk",available_language_codes:["sk"],
        original_language_code:"sk",source_country_code:"SK"},
       {title:"Český zdroj",owner_name:"CZ",topics:[],audience:[],age_groups:[],
        source_url:"https://example.org/cs",available_language_codes:["cs"],
        original_language_code:"cs",source_country_code:"CZ",
        excerpt_sk:"Slovenské vysvetlenie českého článku."},
       {title:"Fínsky plagát",owner_name:"FI",topics:[],audience:[],age_groups:[],
        source_url:"https://example.org/fi",available_language_codes:["en","de"],
        original_language_code:null,source_country_code:"FI"}
      ])
    }));
    await page.reload({waitUntil:"load"});
    await page.locator("#resource-language option[value=cs]").waitFor();
    await page.locator("#resource-language").selectOption("cs");
    assert.equal(await page.locator("#resource-results-count").innerText(),"1");
    assert.match(await page.locator("#resource-list").innerText(),/Slovenské vysvetlenie/);
    await page.locator("#resource-country").selectOption("FI");
    assert.equal(await page.locator("#resource-results-count").innerText(),"0");
    await page.locator("#clear-resource-filters").click();
    await page.locator("#resource-original-language").selectOption("cs");
    assert.equal(await page.locator("#resource-results-count").innerText(),"1");
    await page.locator("#clear-resource-filters").click();
    await page.unroute("**/api/resources");

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
    // Simulate a dedicated staging backend to verify real admin UI interactions.
    const simulated = await browser.newPage();
    const simulatedErrors = [];
    simulated.on("pageerror", e => simulatedErrors.push(e.message));
    let issues = 0;
    await simulated.route("**/api/admin-config", route=>route.fulfill({
      status:200,contentType:"application/json",
      body:JSON.stringify({url:"https://ci-staging-123.supabase.co",key:"public-test"})
    }));
    const jwt=(aal)=>["eyJhbGciOiJFUzI1NiJ9",
      Buffer.from(JSON.stringify({aal,sub:"11111111-1111-4111-8111-111111111111",
        role:"authenticated",exp:Math.floor(Date.now()/1000)+3600})).toString("base64url"),
      "mock-signature"].join(".");
    const cors={"access-control-allow-origin":"*"};
    await simulated.route("https://ci-staging-123.supabase.co/auth/v1/token?grant_type=password", route=>route.fulfill({
      status:200,contentType:"application/json",headers:cors,
      body:JSON.stringify({access_token:jwt("aal1")})
    }));
    let logoutCalls=0;
    await simulated.route("https://ci-staging-123.supabase.co/auth/v1/logout", route=>{
      logoutCalls++;
      return route.fulfill({status:204,headers:{"access-control-allow-origin":"*"}});
    });
    await simulated.route("https://ci-staging-123.supabase.co/auth/v1/user", route=>route.fulfill({
      status:200,contentType:"application/json",headers:cors,
      body:JSON.stringify({factors:[]})
    }));
    await simulated.route("https://ci-staging-123.supabase.co/auth/v1/factors", route=>route.fulfill({
      status:200,contentType:"application/json",headers:cors,
      body:JSON.stringify({id:"factor-id",totp:{qr_code:"<svg xmlns='http://www.w3.org/2000/svg'/>",secret:"TEST-MFA-SECRET"}})
    }));
    await simulated.route("https://ci-staging-123.supabase.co/auth/v1/factors/factor-id/challenge", route=>route.fulfill({
      status:200,contentType:"application/json",headers:cors,body:JSON.stringify({id:"challenge-id"})
    }));
    await simulated.route("https://ci-staging-123.supabase.co/auth/v1/factors/factor-id/verify", route=>route.fulfill({
      status:200,contentType:"application/json",headers:cors,body:JSON.stringify({access_token:jwt("aal2")})
    }));
    await simulated.route("**/api/admin-links", route=>{
      if(route.request().method()==="GET") return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({ambulances:[{external_id:"clinic-test",name:"Test ambulancia",city:"Bratislava",capacity_status:"unknown",link_status:"not_issued"}]})});
      issues++;
      return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({ok:true,action:"issue",ambulance:"clinic-test",link:"https://staging.example.com/#kapacita/clinic-test/"+ "a".repeat(64)})});
    });
    await simulated.goto("http://127.0.0.1:4173/admin.html", {waitUntil:"load"});
    assert.equal(await simulated.locator("#login").isVisible(),true);
    await simulated.locator("#email").fill("admin@example.com");
    await simulated.locator("#password").fill("test-password");
    await simulated.locator("#login-form button").click();
    await simulated.locator("#mfa").waitFor({state:"visible"});
    assert.equal(await simulated.locator("#dashboard").isHidden(),true);
    await simulated.locator("#mfa-enroll").click();
    await simulated.locator("#mfa-secret-box").waitFor({state:"visible"});
    assert.equal(await simulated.locator("#mfa-secret").innerText(),"TEST-MFA-SECRET");
    await simulated.locator("#mfa-code").fill("123456");
    await simulated.locator("#mfa-form button").click();
    await simulated.locator("#dashboard").waitFor({state:"visible"});
    assert.equal(await simulated.locator("#mfa-secret").innerText(),"");
    assert.equal(await simulated.locator("#clinics tr").count(),1);
    simulated.once("dialog",dialog=>dialog.accept());
    await simulated.locator("#clinics tr button").first().click();
    await simulated.locator("#secret-dialog").waitFor({state:"visible"});
    assert.match(await simulated.locator("#secret-link").inputValue(),/#kapacita\/clinic-test\/[a-f0-9]{64}$/);
    assert.equal(issues,1);
    await simulated.locator("#close-secret").click();
    assert.equal(await simulated.locator("#secret-link").inputValue(),"");
    await simulated.locator("#signout").click();
    await simulated.waitForFunction(() => document.querySelector("#status").textContent==="Odhlásený.");
    assert.equal(logoutCalls,1);
    assert.equal(await simulated.locator("#dashboard").isHidden(),true);
    assert.equal(await simulated.locator("#login").isVisible(),true);
    assert.deepEqual(simulatedErrors,[]);
    await simulated.close();
    console.log("Browser smoke tests passed: questionnaire, navigation, crisis route, learning paths, locked staging admin.");

  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
