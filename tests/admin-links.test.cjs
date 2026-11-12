const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../api/admin-links.js");
const configHandler = require("../api/admin-config.js");
const ORIGINAL = {...process.env};
function setEnv(){
 process.env.ADMIN_ENABLED="true";
 process.env.ADMIN_ENVIRONMENT="preview";
 process.env.VERCEL_ENV="preview";
 process.env.ADMIN_SUPABASE_URL="https://ci-staging-123.supabase.co";
 process.env.ADMIN_SUPABASE_PUBLISHABLE_KEY="public-test-key";
 process.env.ADMIN_SUPABASE_SECRET_KEY="server-test-key";
 process.env.ADMIN_RATE_LIMIT_SECRET="0123456789abcdef".repeat(4);
 process.env.ADMIN_APP_ORIGIN="https://staging.example.com";
 process.env.NEXT_PUBLIC_SUPABASE_URL="https://ci-staging-123.supabase.co";
}
function response(){
 return {code:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this;},
 status(v){this.code=v;return this;},json(v){this.body=v;return this;}};
}
async function invoke(handler,method,body,headers={}){
 const res=response();
 const actualHeaders=headers.authorization===token?{...headers,authorization:trustedToken()}:headers;
 await handler({method,body,headers:actualHeaders,socket:{remoteAddress:"127.0.0.1"}},res);
 return res;
}
const token="Bearer "+"x".repeat(40);
const id="11111111-1111-4111-8111-111111111111";
function trustedToken(aal="aal2") {
 const header=Buffer.from(JSON.stringify({alg:"ES256",typ:"JWT"})).toString("base64url");
 const payload=Buffer.from(JSON.stringify({
  sub:id,aal,role:"authenticated",
  iss:process.env.ADMIN_SUPABASE_URL+"/auth/v1",
  exp:Math.floor(Date.now()/1000)+3600
 })).toString("base64url");
 return "Bearer "+header+"."+payload+".testsignature";
}
const clinic="clinic-test";
const requests=[];
async function mockFetch(url,options={}){
 requests.push({url,options});
 if(url.includes("/rpc/consume_admin_rate_limit"))return {ok:true,status:200,json:async()=>true};
 if(url.includes("/auth/v1/user"))return {ok:true,status:200,json:async()=>({id})};
 if(url.includes("/admin_users?"))return {ok:true,status:200,json:async()=>[{user_id:id}]};
 if(url.includes("/rest/v1/ambulances?")){
  if(options.method==="PATCH")return {ok:true,status:200,json:async()=>[{external_id:clinic,capacity_token_expires_at:"2027-04-01T00:00:00Z"}]};
  return {ok:true,status:200,json:async()=>[{external_id:clinic,name:"Test",city:"Bratislava",capacity_status:"unknown",capacity_token_expires_at:null}]};
 }
 throw Error("Unexpected upstream request");
}
test("admin API is unavailable without explicit activation",async()=>{
 const r=await invoke(api,"GET");
 assert.equal(r.code,503);
 assert.equal(r.headers["Cache-Control"],"no-store");
});
test("production Supabase project is never accepted as staging",async()=>{
 const old={...process.env};
 try{setEnv();process.env.ADMIN_SUPABASE_URL="https://cxopqzxdtxjtuxzatldx.supabase.co";
 assert.equal((await invoke(api,"GET")).code,503);}
 finally{process.env=old;}
});
test("admin UI configuration publishes no secret",async()=>{
 const old={...process.env};
 try{setEnv();const r=await invoke(configHandler,"GET");
 assert.equal(r.code,200);assert.deepEqual(Object.keys(r.body).sort(),["key","url"]);
 assert.notEqual(r.body.key,process.env.ADMIN_SUPABASE_SECRET_KEY);}
 finally{process.env=old;}
});
test("anonymous admin list is denied without any DB calls",async()=>{
 const old={...process.env},saved=global.fetch;
 try{setEnv();requests.length=0;global.fetch=mockFetch;
 assert.equal((await invoke(api,"GET")).code,403);assert.equal(requests.length,1);}
 finally{process.env=old;global.fetch=saved;}
});
test("cross-origin mutations are denied without any DB calls",async()=>{
 const old={...process.env},saved=global.fetch;
 try{setEnv();requests.length=0;global.fetch=mockFetch;
 const r=await invoke(api,"POST",{action:"issue",ambulance:clinic},{authorization:token,origin:"https://attacker.example"});
 assert.equal(r.code,403);assert.equal(requests.length,0);}
 finally{process.env=old;global.fetch=saved;}
});
test("authorized admin can read clinic status without token hash",async()=>{
 const old={...process.env},saved=global.fetch;
 try{setEnv();requests.length=0;global.fetch=mockFetch;
 const r=await invoke(api,"GET",null,{authorization:token});assert.equal(r.code,200);
 assert.equal(r.body.ambulances.length,1);
 assert.equal(r.body.ambulances[0].link_status,"not_issued");
 assert.doesNotMatch(JSON.stringify(r.body),/update_token_hash|server-test-key/);}
 finally{process.env=old;global.fetch=saved;}
});
test("issuing uses 256-bit token, stores only hash and returns link once",async()=>{
 const old={...process.env},saved=global.fetch;
 try{setEnv();requests.length=0;global.fetch=mockFetch;
 const r=await invoke(api,"POST",{action:"issue",ambulance:clinic},
  {authorization:token,origin:process.env.ADMIN_APP_ORIGIN,"content-type":"application/json"});
 assert.equal(r.code,200);
 assert.match(r.body.link,/^https:\/\/staging\.example\.com\/#kapacita\/clinic-test\/[0-9a-f]{64}$/);
 const patch=requests.find(x=>x.options.method==="PATCH");
 const data=JSON.parse(patch.options.body);
 assert.match(data.update_token_hash,/^[0-9a-f]{64}$/);
 assert.equal(data.update_token_hash,require("node:crypto").createHash("sha256").update(r.body.link.split("/").pop()).digest("hex"));
 assert.ok(!JSON.stringify(patch).includes(r.body.link.split("/").pop()));
 assert.equal(patch.options.headers["x-admin-user-id"],id);
 }
 finally{process.env=old;global.fetch=saved;}
});
test("revoke sends null token fields and never returns a link",async()=>{
 const old={...process.env},saved=global.fetch;
 try{setEnv();requests.length=0;global.fetch=mockFetch;
 const r=await invoke(api,"POST",{action:"revoke",ambulance:clinic},
  {authorization:token,origin:process.env.ADMIN_APP_ORIGIN,"content-type":"application/json"});
 assert.equal(r.code,200);assert.equal(r.body.link,undefined);
 const data=JSON.parse(requests.find(x=>x.options.method==="PATCH").options.body);
 assert.deepEqual([data.update_token_hash,data.capacity_token_issued_at,data.capacity_token_expires_at],[null,null,null]);}
 finally{process.env=old;global.fetch=saved;}
});

test("staging admin cannot target a different project than preview API",async()=>{
 const old={...process.env};
 try{setEnv();process.env.NEXT_PUBLIC_SUPABASE_URL="https://some-other-staging.supabase.co";
 assert.equal((await invoke(api,"GET")).code,503);}
 finally{process.env=old;}
});
test("admin endpoints are disabled on production deployments",async()=>{
 const old={...process.env};
 try{setEnv();process.env.VERCEL_ENV="production";
 assert.equal((await invoke(api,"GET")).code,503);
 assert.equal((await invoke(configHandler,"GET")).code,503);}
 finally{process.env=old;}
});

test("production DB is permitted only on configured production deployment",async()=>{
 const old={...process.env},saved=global.fetch;
 try{
  setEnv();
  process.env.ADMIN_ENVIRONMENT="production";
  process.env.VERCEL_ENV="production";
  process.env.ADMIN_SUPABASE_URL="https://cxopqzxdtxjtuxzatldx.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_URL=process.env.ADMIN_SUPABASE_URL;
  process.env.ADMIN_APP_ORIGIN="https://cestakpomoci.sk";
  requests.length=0;global.fetch=mockFetch;
  const r=await invoke(api,"GET",null,{authorization:token});
  assert.equal(r.code,200);
  assert.equal((await invoke(configHandler,"GET")).code,200);
 }finally{process.env=old;global.fetch=saved;}
});
test("production admin fails closed without explicit enable flag",async()=>{
 const old={...process.env},saved=global.fetch;
 try{
  setEnv();process.env.ADMIN_ENVIRONMENT="production";process.env.VERCEL_ENV="production";
  process.env.ADMIN_SUPABASE_URL="https://cxopqzxdtxjtuxzatldx.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_URL=process.env.ADMIN_SUPABASE_URL;
  process.env.ADMIN_ENABLED="false";
  requests.length=0;global.fetch=mockFetch;
  assert.equal((await invoke(api,"GET",null,{authorization:token})).code,503);
  assert.equal(requests.length,0);
 }finally{process.env=old;global.fetch=saved;}
});

test("rate limiter rejects excess requests before authentication and hides raw IP",async()=>{
 const old={...process.env},saved=global.fetch;
 try {
  setEnv();requests.length=0;
  global.fetch=async(url,options)=>{
   requests.push({url,options});
   if(url.includes("/rpc/consume_admin_rate_limit"))return {ok:true,status:200,json:async()=>false};
   throw Error("Should not reach auth");
  };
  const r=await invoke(api,"GET",null,{authorization:token});
  assert.equal(r.code,429);assert.equal(requests.length,1);
  assert.doesNotMatch(JSON.stringify(requests),/127\\.0\\.0\\.1|test-bearer-token/);
  const body=JSON.parse(requests[0].options.body);
  assert.match(body.p_key,/^[a-f0-9]{64}$/);
  assert.equal(body.p_limit,30);
 }finally{process.env=old;global.fetch=saved;}
});
test("admin mutation uses a stricter per-minute limit",async()=>{
 const old={...process.env},saved=global.fetch;
 try{
  setEnv();requests.length=0;global.fetch=mockFetch;
  const r=await invoke(api,"POST",{action:"revoke",ambulance:clinic},
   {authorization:token,origin:process.env.ADMIN_APP_ORIGIN,"content-type":"application/json"});
  assert.equal(r.code,200);
  const request=requests.find(x=>x.url.includes("consume_admin_rate_limit"));
  assert.equal(JSON.parse(request.options.body).p_limit,5);
 }finally{process.env=old;global.fetch=saved;}
});
test("admin operation fails closed when limiter is unreachable",async()=>{
 const old={...process.env},saved=global.fetch;
 try{
  setEnv();requests.length=0;
  global.fetch=async()=>{throw Error("backend unavailable");};
  const r=await invoke(api,"GET",null,{authorization:token});
  assert.equal(r.code,502);
 }finally{process.env=old;global.fetch=saved;}
});
test("no limiter secret means admin is disabled",async()=>{
 const old={...process.env};
 try{
  setEnv();delete process.env.ADMIN_RATE_LIMIT_SECRET;
  assert.equal((await invoke(api,"GET")).code,503);
  assert.equal((await invoke(configHandler,"GET")).code,503);
 }finally{process.env=old;}
});

test("AAL1 session is not privileged even with a valid Auth user",async()=>{
 const old={...process.env}, saved=global.fetch;
 try {
  setEnv();requests.length=0;global.fetch=mockFetch;
  const r=await invoke(api,"GET",null,{authorization:trustedToken("aal1")});
  assert.equal(r.code,403);
  assert.equal(requests.filter(x=>x.url.includes("/admin_users?")).length,0);
 }finally{process.env=old;global.fetch=saved;}
});
test("MFA JWT cannot claim another identity",async()=>{
 const old={...process.env},saved=global.fetch;
 try {
  setEnv();requests.length=0;global.fetch=mockFetch;
  const jwt=trustedToken().split(".");
  const altered=Buffer.from(JSON.stringify({
   sub:"22222222-2222-4222-8222-222222222222",aal:"aal2",
   role:"authenticated",iss:process.env.ADMIN_SUPABASE_URL+"/auth/v1",exp:Math.floor(Date.now()/1000)+3600
  })).toString("base64url");
  const r=await invoke(api,"GET",null,{authorization:jwt[0]+"."+altered+"."+jwt[2]});
  assert.equal(r.code,403);
 }finally{process.env=old;global.fetch=saved;}
});
