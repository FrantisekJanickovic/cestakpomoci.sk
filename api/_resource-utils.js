const crypto=require("node:crypto");
function config(){
 const base=(process.env.ADMIN_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/$/,"");
 const key=process.env.ADMIN_SUPABASE_SECRET_KEY||"";
 const pepper=process.env.ADMIN_RATE_LIMIT_SECRET||"";
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base)||!key||!pepper) return null;
 return {base,key,pepper};
}
function headers(c,extra={}){
 return {apikey:c.key,...(!c.key.startsWith("sb_")?{Authorization:"Bearer "+c.key}:{}),...extra};
}
async function request(c,path,options={}){
 const r=await fetch(c.base+"/rest/v1/"+path,{
   method:options.method||"GET",
   headers:headers(c,options.body?{"Content-Type":"application/json",...options.headers}:options.headers),
   ...(options.body?{body:JSON.stringify(options.body)}:{}),
   signal:AbortSignal.timeout(7000),
   cache:"no-store"
 });
 if(!r.ok) {const err=new Error("Storage error "+r.status);err.status=r.status;throw err;}
 if(r.status===204||r.status===201 && options.headers?.Prefer==="return=minimal")return null;
 const raw=await r.text();return raw?JSON.parse(raw):null;
}
function validId(value){return typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);}
function fingerprint(c,req,id){
 const xff=req.headers?.["x-forwarded-for"];
 const ip=req.headers?.["x-real-ip"]|| (typeof xff==="string"?xff.split(",")[0].trim():null) || req.socket?.remoteAddress ||"unknown";
 const ua=String(req.headers?.["user-agent"]||"").slice(0,200);
 return crypto.createHmac("sha256",c.pepper).update("feedback/v1\0"+ip+"\0"+ua+"\0"+id).digest("hex");
}
function sameOrigin(req){
 const origin=req.headers?.origin;
 const host=req.headers?.host;
 if(!origin||!host)return false;
 try{return new URL(origin).host===host && new URL(origin).protocol==="https:" || origin==="http://localhost:4173" && host==="localhost:4173";}catch{return false;}
}
module.exports={config,headers,request,validId,fingerprint,sameOrigin};
