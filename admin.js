// Intentionally session-memory only: no token persistence, cookies or localStorage.
let sessionToken = null, settings = null, pending = false, mfaFactorId = null;
const $ = s=>document.querySelector(s);
function showStatus(text){$("#status").textContent=text;}
function safeText(text){return document.createTextNode(String(text??""));}
function cell(row,text){const td=document.createElement("td");td.appendChild(safeText(text));row.appendChild(td);return td;}
function formatDate(iso){return iso?new Date(iso).toLocaleDateString("sk-SK"):"—";}
async function init(){
 try{
  const response=await fetch("/api/admin-config",{cache:"no-store"});
  if(!response.ok)throw Error("Administrácia nie je nakonfigurovaná. Vyžaduje schváleného správcu a serverovú konfiguráciu.");
  settings=await response.json();
  showStatus("Administrátorské pripojenie je pripravené.");
  $("#login").hidden=false;
 }catch(e){showStatus(e.message);}
}
function aal(token){
 try { return JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).aal; }
 catch { return null; }
}
async function authRequest(method,path,body){
 const response=await fetch(settings.url+"/auth/v1"+path,{
  method,cache:"no-store",
  headers:{apikey:settings.key,Authorization:"Bearer "+sessionToken,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok) throw Error(data.msg||data.message||data.error_description||"Nepodarilo sa overiť druhý faktor.");
 return data;
}
async function showDashboard(){
 await refresh();
 $("#mfa").hidden=true;
 $("#login").hidden=true;
 $("#dashboard").hidden=false;
 showStatus("Prihlásený správca s dvojfaktorovým overením.");
}
async function beginMfa(){
 if(aal(sessionToken)==="aal2")return showDashboard();
 const user=await authRequest("GET","/user");
 const factor=(user.factors||[]).find(f=>f.factor_type==="totp"&&f.status==="verified");
 mfaFactorId=factor?.id||null;
 $("#mfa").hidden=false;
 $("#login").hidden=true;
 $("#mfa-code").value="";
 $("#mfa-setup").hidden=!!factor;
 $("#mfa-enroll").hidden=false;
 $("#mfa-secret-box").hidden=true;
 $("#mfa-description").textContent=factor
  ?"Zadaj šesťmiestny kód z autentifikátora."
  :"Pred prvým prihlásením nastav dvojfaktorové overenie. Po skenovaní QR kódu zadaj vygenerovaný kód.";
 showStatus("Na vstup do administrácie je povinné dvojfaktorové overenie.");
}
async function login(event){
 event.preventDefault();
 showStatus("Overujem prihlásenie…");
 try{
  const response=await fetch(settings.url+"/auth/v1/token?grant_type=password",{
   method:"POST",headers:{"Content-Type":"application/json",apikey:settings.key},
   body:JSON.stringify({email:$("#email").value,password:$("#password").value})
  });
  const data=await response.json();
  $("#password").value="";
  if(!response.ok||!data.access_token)throw Error("Nesprávne prihlasovacie údaje.");
  sessionToken=data.access_token;
  await beginMfa();
 }catch(e){sessionToken=null;$("#mfa").hidden=true;$("#login").hidden=false;showStatus(e.message);}
}
async function enrollMfa(){
 try{
  $("#mfa-enroll").disabled=true;
  const data=await authRequest("POST","/factors",{factor_type:"totp",friendly_name:"Cesta k pomoci"});
  if(!data.id||!data.totp?.qr_code||!data.totp?.secret)throw Error("Supabase neposlal údaje na aktiváciu autentifikátora.");
  mfaFactorId=data.id;
  const qr=data.totp.qr_code;
  // Render only an SVG image in a data URL; never inject remote SVG markup into the DOM.
  $("#mfa-qr").src=qr.startsWith("data:image/svg+xml")?qr:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(qr);
  $("#mfa-secret").textContent=data.totp.secret;
  $("#mfa-secret-box").hidden=false;
  showStatus("Naskenuj QR kód a zadaj šesťmiestny kód.");
 }catch(e){$("#mfa-enroll").disabled=false;showStatus(e.message);}
}
async function verifyMfa(event){
 event.preventDefault();
 const code=$("#mfa-code").value.trim();
 if(!/^[0-9]{6}$/.test(code)||!mfaFactorId)return showStatus("Najprv nastav autentifikátor a zadaj platný šesťmiestny kód.");
 try{
  const challenge=await authRequest("POST","/factors/"+encodeURIComponent(mfaFactorId)+"/challenge",{});
  if(!challenge.id)throw Error("Overovacia výzva nebola vytvorená.");
  const verified=await authRequest("POST","/factors/"+encodeURIComponent(mfaFactorId)+"/verify",{challenge_id:challenge.id,code});
  $("#mfa-code").value="";
  if(!verified.access_token||aal(verified.access_token)!=="aal2")throw Error("Dvojfaktorové overenie nebolo dokončené.");
  sessionToken=verified.access_token;
  $("#mfa-secret").textContent="";
  $("#mfa-qr").removeAttribute("src");
  await showDashboard();
 }catch(e){showStatus(e.message);}
}
function signout(){
 sessionToken=null;mfaFactorId=null;
 $("#dashboard").hidden=true;$("#mfa").hidden=true;$("#login").hidden=false;
 $("#password").value="";$("#mfa-code").value="";
 $("#mfa-secret").textContent="";$("#mfa-qr").removeAttribute("src");
 showStatus("Odhlásený.");
}
async function adminRequest(method,body){
 const response=await fetch("/api/admin-links",{
  method,cache:"no-store",
  headers:{Authorization:"Bearer "+sessionToken,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const data=await response.json();
 if(!response.ok)throw Error(data.error||"Operácia zlyhala.");
 return data;
}
async function refresh(){
 const data=await adminRequest("GET");
 const tbody=$("#clinics");tbody.replaceChildren();
 data.ambulances.forEach(a=>{
  const tr=document.createElement("tr");
  cell(tr,a.name+" · "+(a.city||"")+" ("+a.external_id+")");
  cell(tr,a.link_status==="active"?"Aktívny":a.link_status==="expired"?"Expirovaný":"Nevydaný");
  cell(tr,formatDate(a.capacity_token_expires_at));
  cell(tr,a.capacity_status||"Neoverená");
  const ops=document.createElement("td");
  for(const [action,label,klass] of [["issue","Vydať / obnoviť","soft"],["revoke","Zneplatniť","danger"]]){
   const button=document.createElement("button");button.type="button";button.className=klass;button.textContent=label;
   button.addEventListener("click",()=>operate(a,action));ops.appendChild(button);
  }
  tr.appendChild(ops);tbody.appendChild(tr);
 });
}
async function operate(a,action){
 if(pending)return;
 const question=action==="issue"?
  "Vydať nový odkaz pre "+a.name+"? Predchádzajúci okamžite prestane fungovať.":
  "Naozaj okamžite zneplatniť odkaz pre "+a.name+"?";
 if(!confirm(question))return;
 pending=true;$("#notice").textContent="Ukladám zmenu…";
 try{
  const result=await adminRequest("POST",{action,ambulance:a.external_id});
  $("#notice").textContent=action==="revoke"?"Odkaz bol zneplatnený.":"Nový odkaz bol vygenerovaný.";
  if(result.link){
   $("#secret-link").value=result.link;
   $("#secret-dialog").showModal();
  }
  await refresh();
 }catch(e){$("#notice").textContent=e.message;}finally{pending=false;}
}
$("#login-form").addEventListener("submit",login);
$("#signout").addEventListener("click",signout);
$("#mfa-cancel").addEventListener("click",signout);
$("#mfa-enroll").addEventListener("click",enrollMfa);
$("#mfa-form").addEventListener("submit",verifyMfa);
$("#close-secret").addEventListener("click",()=>{$("#secret-dialog").close();$("#secret-link").value="";});
$("#copy-link").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("#secret-link").value);$("#notice").textContent="Odkaz skopírovaný.";}catch{$("#secret-link").select();$("#notice").textContent="Označený odkaz skopíruj ručne."; }});
init();
