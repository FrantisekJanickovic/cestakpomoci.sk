const {config,headers,request,validId}=require("./_resource-utils");
module.exports=async function handler(req,res){
 res.setHeader("Cache-Control","private, no-store");
 res.setHeader("X-Robots-Tag","noindex, nofollow");
 res.setHeader("X-Content-Type-Options","nosniff");
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 const id=req.query?.id;
 if(!validId(id))return res.status(400).json({error:"Invalid resource ID"});
 const c=config();
 if(!c)return res.status(503).json({error:"Counting service unavailable"});
 try{
  const rows=await request(c,"content_resources?select=id,source_url&is_published=eq.true&id=eq."+encodeURIComponent(id)+"&limit=1");
  const url=rows?.[0]?.source_url;
  if(!url)return res.status(404).json({error:"Resource unavailable"});
  const dest=new URL(url);
  if(!["https:","http:"].includes(dest.protocol)||dest.username||dest.password)return res.status(400).json({error:"Invalid destination"});
  try {
    await request(c,"rpc/record_resource_open",{method:"POST",body:{p_resource_id:id},headers:{"Prefer":"return=minimal"}});
  } catch(e){console.error("Resource click counter unavailable",e.message);}
  res.setHeader("Location",dest.href);
  return res.status(302).end();
 }catch(e){console.error("Resource opening failed",e.message);return res.status(502).json({error:"Resource temporarily unavailable"});}
};