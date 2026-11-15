const {config,request,validId,fingerprint,sameOrigin}=require("./_resource-utils");
function clean(value,max){return String(value||"").replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,max);}
module.exports=async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 if(!["GET","POST"].includes(req.method)){res.setHeader("Allow","GET, POST");return res.status(405).json({error:"Method not allowed"});}
 const id=req.method==="GET"?req.query?.id:req.body?.resourceId;
 if(!validId(id))return res.status(400).json({error:"Neplatný identifikátor materiálu."});
 const c=config();
 if(!c)return res.status(503).json({error:"Hodnotenia sú momentálne nedostupné."});
 try {
  if(req.method==="GET"){
   const filter="resource_feedback?select=id,display_name,body,rating,created_at&resource_id=eq."+encodeURIComponent(id)+"&status=eq.approved&order=created_at.desc&limit=30";
   const rows=await request(c,filter);
   return res.status(200).json({comments:rows||[]});
  }
  if(!sameOrigin(req))return res.status(403).json({error:"Neplatný pôvod požiadavky."});
  if(!String(req.headers?.["content-type"]||"").toLowerCase().startsWith("application/json"))return res.status(415).json({error:"Očakáva sa JSON."});
  const body=req.body||{};
  if(body.website||body.contact_url)return res.status(202).json({message:"Ďakujeme za spätnú väzbu."});
  const name=clean(body.name,35)||"Anonym";
  const comment=clean(body.comment,1201);
  const rating=Number(body.rating);
  if(comment.length<8||comment.length>1200||!Number.isInteger(rating)||rating<1||rating>5||name.length>35)
   return res.status(400).json({error:"Napíš aspoň 8 znakov a vyber 1–5 hviezdičiek."});
  if(/https?:\/\/|\bwww\./i.test(comment))return res.status(400).json({error:"Komentár nesmie obsahovať externé odkazy."});
  const exists=await request(c,"content_resources?select=id&is_published=eq.true&id=eq."+encodeURIComponent(id)+"&limit=1");
  if(!exists?.length)return res.status(404).json({error:"Materiál sa nenašiel."});
  const hash=fingerprint(c,req,id);
  try{
   await request(c,"resource_feedback",{method:"POST",body:{resource_id:id,display_name:name,body:comment,rating,actor_hash:hash,status:"pending"},headers:{"Prefer":"return=minimal"}});
  }catch(e){if(e.status===409)return res.status(429).json({error:"Z tohto zariadenia už bol materiál hodnotený. Ďalšie hodnotenie môžeš odoslať po moderácii iba pri zamietnutí pôvodného."});throw e;}
  return res.status(202).json({message:"Ďakujeme. Komentár aj hodnotenie zverejníme až po kontrole."});
 }catch(e){console.error("Resource feedback failure",e.message);return res.status(502).json({error:"Hodnotenie sa nepodarilo odoslať."});}
};