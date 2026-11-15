const test=require("node:test");
const assert=require("node:assert/strict");
process.env.ADMIN_SUPABASE_URL="https://example.supabase.co";
process.env.ADMIN_SUPABASE_SECRET_KEY="sb_secret_test_only";
process.env.ADMIN_RATE_LIMIT_SECRET="test_pepper";
const open=require("../api/resource-open");
const feedback=require("../api/resource-feedback");
const id="11111111-1111-4111-8111-111111111111";
function res(){return {code:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this;},status(k){this.code=k;return this;},json(v){this.body=v;return this;},end(){return this;}};}
test("open endpoint denies invalid resource ids without database lookup",async()=>{
 const r=res();await open({method:"GET",query:{id:"bad"}},r);
 assert.equal(r.code,400);
});
test("feedback endpoint rejects missing Origin and invalid ratings",async()=>{
 const r=res();
 await feedback({method:"POST",headers:{host:"localhost:4173","content-type":"application/json"},body:{resourceId:id,rating:5}},r);
 assert.equal(r.code,403);
});
test("feedback read endpoint requires valid resource id",async()=>{
 const r=res();await feedback({method:"GET",query:{id:"invalid"}},r);
 assert.equal(r.code,400);
});

function mock(data,status=200){return {ok:true,status,text:async()=>data===null?"":JSON.stringify(data)};}
test("opening a published source records click and redirects only to catalog URL",async()=>{
 const old=global.fetch;const calls=[];
 global.fetch=async(url,opts)=>{
  calls.push({url,opts});
  return url.includes("record_resource_open")?mock(null,204):mock([{source_url:"https://mieli.fi/en/materials/"}]);
 };
 try{
  const r=res();await open({method:"GET",query:{id},headers:{}},r);
  assert.equal(r.code,302);assert.equal(r.headers.Location,"https://mieli.fi/en/materials/");
  assert.equal(calls.length,2);assert.ok(calls[1].url.includes("record_resource_open"));
  assert.equal(calls[1].opts.headers.apikey,"sb_secret_test_only");
 }finally{global.fetch=old;}
});
test("approved feedback uses a filtered read",async()=>{
 const old=global.fetch;let path="";
 global.fetch=async(url)=>{path=url;return mock([{id:"review",rating:5,body:"Dobrý zdroj."}]);};
 try{
  const r=res();await feedback({method:"GET",query:{id},headers:{}},r);
  assert.equal(r.code,200);assert.equal(r.body.comments.length,1);
  assert.ok(path.includes("status=eq.approved"));assert.ok(path.includes("body=not.is.null"));
 }finally{global.fetch=old;}
});
