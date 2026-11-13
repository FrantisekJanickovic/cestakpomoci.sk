const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-public-key";

function response() {
  return {
    headers: {}, code: 200, body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(n) { this.code = n; return this; },
    json(v) { this.body = v; return this; },
    end() { return this; },
  };
}
async function invoke(name, req, mockFetch) {
  const previous = global.fetch;
  global.fetch = mockFetch || (() => { throw Error("Unexpected upstream request"); });
  try {
    const res = response();
    await require("../api/" + name + ".js")(req, res);
    return res;
  } finally { global.fetch = previous; }
}

test("capacity rejects unsupported methods before contacting database", async () => {
  const r = await invoke("capacity", { method: "DELETE" });
  assert.equal(r.code, 405);
  assert.equal(r.headers.Allow, "GET, POST");
});
test("capacity rejects impossible calendar date and never writes", async () => {
  const r = await invoke("capacity", {
    method: "POST", body: { ambulance: "clinic-01", token: "a".repeat(64),
      status: "accepting", earliestDate: "2026-02-31", slots30d: 2 }
  });
  assert.equal(r.code, 400);
});
test("capacity rejects oversized public note", async () => {
  const r = await invoke("capacity", {
    method: "POST", body: { ambulance: "clinic-01", token: "a".repeat(64),
      status: "call", note: "x".repeat(241) }
  });
  assert.equal(r.code, 400);
});
test("capacity rejects malformed token before contacting database", async () => {
  const r = await invoke("capacity", {
    method: "POST", body: { ambulance: "clinic-01", token: "x".repeat(64), status: "call" }
  });
  assert.equal(r.code, 400);
});
test("capacity returns 403 when valid-looking token matches no row", async () => {
  const r = await invoke("capacity", {
    method: "POST", body: { ambulance: "clinic-01", token: "a".repeat(64), status: "call" }
  }, async () => ({ ok: true, json: async () => [] }));
  assert.equal(r.code, 403);
});
test("capacity GET returns 502 for upstream errors", async () => {
  const r = await invoke("capacity", { method: "GET", query: { ambulance: "clinic-01" } },
    async () => { throw Error("Connection failed"); });
  assert.equal(r.code, 502);
  assert.equal(r.headers["Cache-Control"], "no-store");
});
test("crisis demands are not stored", async () => {
  const r = await invoke("demand", { method: "POST", body: { urgency: "crisis" } });
  assert.equal(r.code, 204);
});
test("demand rejects arbitrary payload fields and invalid categories", async () => {
  const r = await invoke("demand", { method: "POST", body: { ageBand: "private" } });
  assert.equal(r.code, 400);
});
test("public resources and ambulances allow only GET", async () => {
  for (const name of ["resources", "ambulances"]) {
    const r = await invoke(name, { method: "POST" });
    assert.equal(r.code, 405);
  }
});
test("public resource upstream errors return 502", async () => {
  const r = await invoke("resources", { method: "GET" }, async () => ({ ok: false, status: 503 }));
  assert.equal(r.code, 502);
});

test("modern publishable key is passed via apikey, never as JWT Bearer", async () => {
 const originalKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_ci_test";
 try {
  for(const name of ["resources","ambulances"]){
   let seen=false;
   const r=await invoke(name,{method:"GET"},async(_url,opts)=>{
    seen=true;
    assert.equal(opts.headers.apikey,"sb_publishable_ci_test");
    assert.equal(opts.headers.Authorization,undefined);
    return {ok:true,json:async()=>[]};
   });
   assert.equal(r.code,200);assert.ok(seen);
  }
  let seen=false;
  const r=await invoke("demand",{method:"POST",body:{
   region:"Trnavský",ageBand:"12-18",radiusKm:300,resultCount:0,
   topic:"general",audience:"parent",supportType:"either",urgency:"information",source:"guided_journey"
  }},async(_url,opts)=>{
   seen=true;
   assert.equal(opts.headers.apikey,"sb_publishable_ci_test");
   assert.equal(opts.headers.Authorization,undefined);
   return {ok:true};
  });
  assert.equal(r.code,202);assert.ok(seen);
 }finally{process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=originalKey;}
});
test("modern publishable key used for capacity writes without fake bearer JWT",async()=>{
 const prev=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_ci_test";
 try{
  const r=await invoke("capacity",{method:"POST",body:{
   ambulance:"clinic-01",token:"a".repeat(64),status:"call"
  }},async(_url,opts)=>{
   assert.equal(opts.headers.apikey,"sb_publishable_ci_test");
   assert.equal(opts.headers.Authorization,undefined);
   assert.match(opts.headers["x-capacity-token-hash"],/^[a-f0-9]{64}$/);
   return {ok:true,json:async()=>[{external_id:"clinic-01",capacity_status:"call"}]};
  });
  assert.equal(r.code,200);
 }finally{process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=prev;}
});
