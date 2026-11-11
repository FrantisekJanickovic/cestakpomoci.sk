const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const routes = require("../learning-paths.js");

test("six introductory learning routes are present", () => {
  assert.deepEqual(routes.map((r) => r.slug), ["anxiety", "mood", "adhd", "behaviour", "school", "sleep"]);
  assert.equal(new Set(routes.map((r) => r.slug)).size, 6);
});

test("each route has three labeled guidance steps and a defined escalation category", () => {
  for (const route of routes) {
    assert.ok(route.title && route.summary);
    assert.equal(route.steps.length, 3);
    for (const [heading, guidance, escalation] of route.steps) {
      assert.ok(heading.length >= 8);
      assert.ok(guidance.length >= 30);
      assert.ok(["self_help", "school_support", "professional", "urgent"].includes(escalation));
    }
  }
});

test("learning guides do not save any progress or patient details themselves", () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "learning-paths.js"), "utf8");
  assert.doesNotMatch(script, /localStorage|sessionStorage|fetch\(|XMLHttpRequest|document\.cookie/);
});

test("learning routes appear within the resources view and scripts load in order", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(html.indexOf('id="resources-view"') < html.indexOf('id="learning-path-list"'));
  assert.ok(html.indexOf('id="learning-path-list"') < html.indexOf('id="ambulances-view"'));
  assert.ok(html.indexOf('src="/learning-paths.js"') < html.indexOf('src="/app.js"'));
});

test("questionnaire does not claim kilometre-accurate results", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.doesNotMatch(app, /id="journey-radius"|\$\("#journey-radius"\)/);
  assert.match(app, /Presnú vzdialenosť ani čas cesty zatiaľ nevieme/);
  assert.match(app, /function openLearningPath\(/);
  assert.match(app, /journey-learning/);
});
