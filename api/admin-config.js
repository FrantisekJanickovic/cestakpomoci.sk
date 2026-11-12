// Public metadata only. No service-role secrets are sent to clients.
module.exports=function(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
  const url=process.env.ADMIN_SUPABASE_URL||"";
  const key=process.env.ADMIN_SUPABASE_PUBLISHABLE_KEY||"";
  const prod=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
  const origin=process.env.ADMIN_APP_ORIGIN||"";
  if(process.env.ADMIN_ENVIRONMENT!=="staging"||!key||
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||
    url===prod||url.includes("cxopqzxdtxjtuxzatldx")||
    !/^https:\/\/[a-z0-9.-]+$/.test(origin)||origin.includes("REPLACE"))
    return res.status(503).json({error:"Staging administration is not configured"});
  return res.status(200).json({url,key});
};