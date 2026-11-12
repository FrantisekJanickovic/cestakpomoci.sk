const test=require("node:test");
const assert=require("node:assert/strict");
const handler=require("../api/admin-links.js");
function response(){return {code:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(v){this.code=v;return this;},
  json(v){this.body=v;return this;}
};}
async function invoke(method,body,headers={}){const res=response();await handler({method,body,headers},res);return res;}
test("admin endpoints are disabled by default",async()=>{
  const r=await invoke("GET");assert.equal(r.code,503);assert.equal(r.headers["Cache-Control"],"no-store");
});
test("unsupported methods never reach data source",async()=>{
  const r=await invoke("DELETE");assert.equal(r.code,405);
});
test("production backend cannot be used as staging backend",async()=>{
  const env={...process.env};
  try{
    process.env.ADMIN_ENVIRONMENT="staging";
    process.env.ADMIN_SUPABASE_URL="https://cxopqzxdtxjtuxzatldx.supabase.co";
    process.env.ADMIN_SUPABASE_PUBLISHABLE_KEY="public";
    process.env.ADMIN_SUPABASE_SECRET_KEY="secret";
    process.env.ADMIN_APP_ORIGIN="https://example.vercel.app";
    const r=await invoke("GET");
    assert.equal(r.code,503);
  }finally{process.env=env;}
});
