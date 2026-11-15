const $=s=>document.querySelector(s);
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function safeUrl(value){try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)?u.href:null;}catch{return null;}}
function label(code){return ({SK:"Slovensko",CZ:"Česko",GB:"Spojené kráľovstvo",FI:"Fínsko",DE:"Nemecko",AU:"Austrália",INT:"Medzinárodná organizácia"})[code]||code||"Neuvedené";}
const lang=code=>({sk:"Slovenčina",cs:"Čeština",en:"Angličtina",fi:"Fínčina",de:"Nemčina",uk:"Ukrajinčina"})[code]||code;
function ratingView(item){
 const n=Number(item.rating_count||0);
 if(!n)return '<p class="no-rating">Zatiaľ bez schválených hodnotení.</p>';
 const avg=Number(item.rating_sum||0)/n;
 return '<p class="rating-line"><span class="rating-stars" aria-hidden="true">'+("★".repeat(Math.round(avg))+"☆".repeat(5-Math.round(avg)))+'</span> '+avg.toFixed(1)+' / 5 · '+n+' hodnotení</p>';
}
function fact(label,value){return '<div><dt>'+esc(label)+'</dt><dd>'+esc(value||"Neuvedené")+'</dd></div>';}
async function main(){
 const id=new URLSearchParams(location.search).get("id")||"";
 if(!/^[0-9a-f-]{36}$/i.test(id)){$("#detail-status").textContent="Neplatný odkaz na materiál.";return;}
 try{
  const response=await fetch("/api/resources",{cache:"no-store"});
  if(!response.ok)throw Error("Knižnica je momentálne nedostupná.");
  const item=(await response.json()).find(x=>x.id===id);
  if(!item)throw Error("Materiál sa nenašiel.");
  document.title=item.title+" – Cesta k pomoci";
  $("#detail-title").textContent=item.title;
  $("#detail-crumb").textContent=item.title;
  $("#detail-owner").textContent=item.owner_name;
  $("#detail-format").textContent=item.resource_format||"Odborný materiál";
  $("#detail-rating").innerHTML=ratingView(item);
  $("#detail-excerpt").textContent=item.excerpt_sk||item.evidence_summary||"Podrobnejšie informácie nájdeš na stránke autora. Táto knižnica zhromažďuje overiteľné odkazy na externé materiály.";
  $("#detail-audience").textContent=(item.audience||[]).join(", ")||item.audience_raw||"Všeobecné publikum";
  $("#detail-topics").innerHTML=(item.topics||[]).map(x=>'<span class="chip">'+esc(x)+'</span>').join("");
  $("#detail-facts").innerHTML=[
   fact("Autor / organizácia",item.owner_name),
   fact("Krajina pôvodu",label(item.source_country_code)),
   fact("Jazyk materiálu",(item.available_language_codes||[item.language_code]).map(lang).join(", ")),
   fact("Veková skupina",(item.age_groups||[]).join(", ")||item.age_raw),
   fact("Formát",item.resource_format),
   fact("Cena",item.price_type),
   fact("Prístup",item.access_type),
   fact("Otvárania",item.open_count?String(item.open_count):"Zatiaľ bez záznamu")
  ].join("");
  const valid=safeUrl(item.source_url);
  const button=$("#detail-open");
  if(valid)button.href="/api/resource-open?id="+encodeURIComponent(item.id);
  else button.hidden=true;
  $("#detail-status").hidden=true;$("#detail-main").hidden=false;
  loadReviews(id);
  $("#review-form").addEventListener("submit",async e=>{
   e.preventDefault();
   const form=e.currentTarget,button=form.querySelector('button[type="submit"]');
   const data=new FormData(form);
   const payload={resourceId:id,name:data.get("name"),comment:data.get("comment"),rating:Number(data.get("rating")),website:data.get("website")};
   button.disabled=true;$("#review-message").textContent="Odosielam…";
   try{
    const r=await fetch("/api/resource-feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const result=await r.json();
    if(!r.ok)throw Error(result.error||"Nepodarilo sa odoslať hodnotenie.");
    $("#review-message").textContent=result.message;
    form.reset();
   }catch(error){$("#review-message").textContent=error.message;}
   finally{button.disabled=false;}
  });
 }catch(error){$("#detail-status").textContent=error.message;}
}
async function loadReviews(id){
 try{
  const r=await fetch("/api/resource-feedback?id="+encodeURIComponent(id));
  if(!r.ok)throw Error("Komentáre sa nepodarilo načítať.");
  const {comments=[]}=await r.json();
  $("#published-reviews").innerHTML=comments.length?
   comments.map(c=>'<article class="published-review"><p class="rating-stars" aria-label="'+c.rating+' z 5 hviezd">'+("★".repeat(c.rating)+"☆".repeat(5-c.rating))+'</p><p>'+esc(c.body)+'</p><small>'+esc(c.display_name)+' · '+new Date(c.created_at).toLocaleDateString("sk-SK")+'</small></article>').join(""):
   "<p>Zatiaľ tu nie sú schválené komentáre.</p>";
 }catch(error){$("#published-reviews").textContent="Komentáre sú momentálne nedostupné.";}
}
main();