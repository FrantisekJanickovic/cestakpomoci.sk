// Intentionally session-memory only: no token persistence, cookies or localStorage.
let sessionToken = null, settings = null, pending = false;
const $ = s=>document.querySelector(s);
function showStatus(text){$("#status").textContent=text;}
function safeText(text){return document.createTextNode(String(text??""));}
function cell(row,text){const td=document.createElement("td");td.appendChild(safeText(text));row.appendChild(td);return td;}
function formatDate(iso){return iso?new Date(iso).toLocaleDateString("sk-SK"):"—";}
async function init(){
 try{
  const response=await fetch("/api/admin-config",{cache:"no-store"});
  if(!response.ok)throw Error("Administrácia nie je nakonfigurovaná. Vyžaduje samostatnú staging databázu.");
  settings=await response.json();
  showStatus("Samostatné testovacie pripojenie je pripravené.");
  $("#login").hidden=false;
 }catch(e){showStatus(e.message);}
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
  await refresh();
  $("#login").hidden=true;$("#dashboard").hidden=false;
  showStatus("Prihlásený správca testovacej databázy.");
 }catch(e){sessionToken=null;showStatus(e.message);}
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
$("#signout").addEventListener("click",()=>{sessionToken=null;$("#dashboard").hidden=true;$("#login").hidden=false;$("#password").value="";showStatus("Odhlásený.");});
$("#close-secret").addEventListener("click",()=>{$("#secret-dialog").close();$("#secret-link").value="";});
$("#copy-link").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("#secret-link").value);$("#notice").textContent="Odkaz skopírovaný.";}catch{$("#secret-link").select();$("#notice").textContent="Označený odkaz skopíruj ručne."; }});
init();
