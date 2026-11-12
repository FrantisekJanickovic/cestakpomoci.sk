// Public metadata only. No service-role secrets are sent to clients.
module.exports=function(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
  const url=process.env.ADMIN_SUPABASE_URL||"";
  const key=process.env.ADMIN_SUPABASE_PUBLISHABLE_KEY||"";
  const prod=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
  const origin=process.env.ADMIN_APP_ORIGIN||"";
  const mode=process.env.ADMIN_ENVIRONMENT;
  const deployed=process.env.VERCEL_ENV;
  const isProdDatabase=url==="https://cxopqzxdtxjtuxzatldx.supabase.co";
  if(process.env.ADMIN_ENABLED!=="true"||!["production","preview"].includes(mode)||deployed!==mode||!key||
    !process.env.ADMIN_SUPABASE_SECRET_KEY||
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||url!==prod||
    (mode==="production"&&!isProdDatabase)||(mode==="preview"&&isProdDatabase)||
    !/^https:\/\/[a-z0-9.-]+$/.test(origin)||origin.includes("REPLACE"))
    return res.status(503).json({error:"Administrácia nie je nakonfigurovaná"});
  return res.status(200).json({url,key});
};