// Staging-only clinic link administration. Never connect this API to production.
const { randomBytes, createHash } = require("node:crypto");
const SAFE_ID = /^[\p{L}\p{N}._-]{2,128}$/u;
const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const TIMEOUT = 8000;
function config() {
  const base = process.env.ADMIN_SUPABASE_URL || "";
  const publicKey = process.env.ADMIN_SUPABASE_PUBLISHABLE_KEY || "";
  const secretKey = process.env.ADMIN_SUPABASE_SECRET_KEY || "";
  const origin = process.env.ADMIN_APP_ORIGIN || "";
  const prod = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  // Refuse to operate unless a completely separate staging database is configured.
  if (process.env.ADMIN_ENVIRONMENT !== "staging" || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base)
      || !publicKey || !secretKey || !/^https:\/\/[a-z0-9.-]+$/.test(origin)
      || process.env.VERCEL_ENV === "production" || base !== prod || base.includes("cxopqzxdtxjtuxzatldx") || origin.includes("REPLACE")) return null;
  return { base, publicKey, secretKey, origin };
}
function sbHeaders(key, extra={}) { return { apikey:key, Authorization:"Bearer "+key, ...extra }; }
async function requestJson(url, options) {
  const result = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT), cache:"no-store" });
  const json = await result.json().catch(()=>null);
  return { ok:result.ok, status:result.status, data:json };
}
function err(res,status,message) { return res.status(status).json({error:message}); }
async function authenticate(req,c) {
  const authorization = req.headers?.authorization || "";
  if (!/^Bearer [A-Za-z0-9._~-]{20,4096}$/.test(authorization)) return null;
  const auth = await requestJson(c.base+"/auth/v1/user", {headers:sbHeaders(c.publicKey,{Authorization:authorization})});
  if (!auth.ok || !auth.data || !/^[0-9a-f-]{36}$/i.test(auth.data.id || "")) return null;
  const check = await requestJson(c.base+"/rest/v1/admin_users?select=user_id&user_id=eq."+encodeURIComponent(auth.data.id)+"&active=eq.true&limit=1",{
    headers:sbHeaders(c.secretKey)
  });
  if (!check.ok) throw Error("Admin permission check failed");
  return Array.isArray(check.data) && check.data.length===1 ? auth.data.id : null;
}
module.exports = async function handler(req,res) {
  Object.entries(NO_STORE).forEach(([k,v])=>res.setHeader(k,v));
  res.setHeader("Allow","GET, POST");
  if (!["GET","POST"].includes(req.method)) return err(res,405,"Method not allowed");
  const c=config();
  if (!c) return err(res,503,"Staging administration is not configured");
  // Authentication uses an explicit bearer token; never browser cookies.
  // Mutations are also limited to the configured admin origin.
  if (req.method==="POST" && req.headers.origin !== c.origin) return err(res,403,"Invalid request origin");
  try {
    const userId=await authenticate(req,c);
    if (!userId) return err(res,403,"Administrator access required");
    if (req.method==="GET") {
      const q="select="+encodeURIComponent("external_id,name,city,capacity_status,capacity_updated_at,capacity_token_issued_at,capacity_token_expires_at")+"&active=eq.true&order=name.asc&limit=250";
      const list=await requestJson(c.base+"/rest/v1/ambulances?"+q,{headers:sbHeaders(c.secretKey)});
      if (!list.ok || !Array.isArray(list.data)) throw Error("Failed to read clinics");
      return res.status(200).json({ambulances:list.data.map(a=>({
        external_id:a.external_id,name:a.name,city:a.city,capacity_status:a.capacity_status,
        capacity_updated_at:a.capacity_updated_at,capacity_token_issued_at:a.capacity_token_issued_at,
        capacity_token_expires_at:a.capacity_token_expires_at,
        link_status:!a.capacity_token_expires_at?"not_issued":new Date(a.capacity_token_expires_at).getTime()>Date.now()?"active":"expired"
      }))});
    }
    if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) return err(res,415,"JSON required");
    const body=req.body;
    if (!body || typeof body!=="object" || Array.isArray(body)) return err(res,400,"Invalid payload");
    const { action, ambulance }=body;
    if (!["issue","revoke"].includes(action) || typeof ambulance!=="string" || !SAFE_ID.test(ambulance)) return err(res,400,"Invalid action");
    const raw=action==="issue"?randomBytes(32).toString("hex"):null;
    const now=new Date();
    const patch=raw ? {
      update_token_hash:createHash("sha256").update(raw).digest("hex"),
      capacity_token_issued_at:now.toISOString(),
      capacity_token_expires_at:new Date(now.getTime()+90*86400000).toISOString(),
      updated_at:now.toISOString()
    } : { update_token_hash:null,capacity_token_issued_at:null,capacity_token_expires_at:null,updated_at:now.toISOString() };
    const url=c.base+"/rest/v1/ambulances?external_id=eq."+encodeURIComponent(ambulance)+"&active=eq.true&select="+encodeURIComponent("external_id,capacity_token_expires_at");
    const result=await requestJson(url,{method:"PATCH",headers:sbHeaders(c.secretKey,{
      "Content-Type":"application/json","Prefer":"return=representation","x-admin-user-id":userId
    }),body:JSON.stringify(patch)});
    if (!result.ok) throw Error("Failed to update token");
    if (!Array.isArray(result.data) || result.data.length!==1) return err(res,404,"Ambulance not found");
    return res.status(200).json({ok:true,action,ambulance,
      expires_at:result.data[0].capacity_token_expires_at,
      ...(raw?{link:c.origin+"/#kapacita/"+encodeURIComponent(ambulance)+"/"+raw}:{})
    });
  } catch(e) {
    console.error("Clinic admin operation failed:",e.message);
    return err(res,502,"Administration is temporarily unavailable");
  }
};
