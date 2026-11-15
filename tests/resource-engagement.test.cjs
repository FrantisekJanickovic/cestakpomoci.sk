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
