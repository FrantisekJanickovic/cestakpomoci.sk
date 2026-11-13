const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const sql=fs.readFileSync(path.join(__dirname,"../supabase/mieli-finnish-resources-2026-11-13.sql"),"utf8");
const rows=[...sql.matchAll(/^\('FI(\d{3})'/gm)].map(m=>Number(m[1]));
test("MIELI detailed catalogue lists exactly 37 unique resources FI101–FI137",()=>{
 assert.equal(rows.length,37);
 assert.equal(new Set(rows).size,37);
 assert.deepEqual(rows,Array.from({length:37},(_,i)=>101+i));
});
test("MIELI catalogue uses only the official MIELI publisher for source links",()=>{
 const links=[...sql.matchAll(/https:\/\/[^'\s]+/g)].map(x=>x[0]);
 assert.ok(links.length>=37);
 for(const link of links) assert.match(link,/^https:\/\/mieli\.fi\//);
});
test("MIELI seed is idempotent, has no binary copies and writes Slovak summaries",()=>{
 assert.match(sql,/on conflict\(external_id\) do update/i);
 assert.match(sql,/excerpt_sk/);
 assert.match(sql,/source_country_code/);
 assert.match(sql,/original_language_code/);
 assert.match(sql,/available_language_codes/);
 assert.doesNotMatch(sql,/insert\s+into\s+storage\./i);
});
