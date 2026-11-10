const state = {
  resources: [],
  ambulances: [],
  resourceLimit: 12,
  ambulanceLimit: 15,
  journey: { step: 0, answers: {} },
};

const collator = new Intl.Collator("sk", { sensitivity: "base" });
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const JOURNEY = {
  ages: [
    { value: "0–5 rokov", label: "0–5 rokov", demand: "0-5", sample: 4 },
    { value: "6–9 rokov", label: "6–9 rokov", demand: "6-11", sample: 8 },
    { value: "10–12 rokov", label: "10–12 rokov", demand: "6-11", sample: 11 },
    { value: "13–15 rokov", label: "13–15 rokov", demand: "12-18", sample: 14 },
    { value: "16–18 rokov", label: "16–18 rokov", demand: "12-18", sample: 17 },
  ],
  audiences: [
    { value: "Rodič alebo blízky", label: "Som rodič alebo blízky", demand: "parent" },
    { value: "Dieťa alebo mladý človek", label: "Som mladý človek", demand: "child" },
    { value: "Učiteľ alebo škola", label: "Som učiteľ alebo zo školy", demand: "teacher" },
    { value: "Odborník", label: "Som odborník", demand: "professional" },
  ],
  topics: [
    { value: "Úzkosť a strach", label: "Úzkosť, strach alebo panika", demand: "anxiety" },
    { value: "Depresia a smútok", label: "Smútok, depresívne prežívanie", demand: "mood" },
    { value: "Sebapoškodzovanie a kríza", label: "Sebapoškodzovanie alebo kríza", demand: "self_harm" },
    { value: "ADHD a neurovývin", label: "ADHD, pozornosť alebo neurovývin", demand: "adhd" },
    { value: "Emócie a správanie", label: "Emócie, hnev alebo správanie", demand: "behaviour" },
    { value: "Šikanovanie a online bezpečie", label: "Šikanovanie alebo online bezpečie", demand: "bullying" },
    { value: "Poruchy príjmu potravy a body image", label: "Jedlo, telo alebo poruchy príjmu potravy", demand: "eating" },
    { value: "Vzťahy a triedna klíma", label: "Vzťahy, rodina alebo trieda", demand: "relationships" },
    { value: "Stres a odolnosť", label: "Stres, preťaženie alebo odolnosť", demand: "stress" },
    { value: "Škola a adaptácia", label: "Škola, adaptácia alebo učenie", demand: "school" },
    { value: "Trauma a náročné situácie", label: "Trauma alebo náročná udalosť", demand: "trauma" },
    { value: "Všeobecná prevencia a wellbeing", label: "Neviem presne / všeobecná podpora", demand: "general" },
  ],
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort(collator.compare);
}

function formatRegion(region) {
  const value = String(region || "").trim();
  return /kraj$/i.test(value) ? value : `${value} kraj`;
}

function populateSelect(id, values) {
  const select = $(id);
  values.forEach((value) => {
    if ([...select.options].some((option) => option.value === value)) return;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

async function loadData() {
  const [resourcesResult, ambulancesResult] = await Promise.allSettled([
    fetch("/api/resources"),
    fetch("/api/ambulances"),
  ]);

  if (resourcesResult.status === "fulfilled" && resourcesResult.value.ok) {
    state.resources = await resourcesResult.value.json();
    $("#resource-count").textContent = state.resources.length;
    populateSelect("#topic-filter", uniqueSorted(state.resources.flatMap((item) => item.topics || [])));
    populateSelect("#audience-filter", uniqueSorted(state.resources.flatMap((item) => item.audience || [])));
    populateSelect("#age-filter", uniqueSorted(state.resources.flatMap((item) => item.age_groups || [])));
    renderResources();
  } else {
    renderError("#resource-list", "Zdroje sa momentálne nepodarilo načítať.");
  }

  if (ambulancesResult.status === "fulfilled" && ambulancesResult.value.ok) {
    state.ambulances = await ambulancesResult.value.json();
    $("#ambulance-count").textContent = state.ambulances.length;
    populateSelect("#region-filter", uniqueSorted(state.ambulances.map((item) => item.region)));
    renderAmbulances();
  } else {
    renderError("#ambulance-list", "Ambulancie sa momentálne nepodarilo načítať.");
  }
}

function getFilteredResources() {
  const query = normalize($("#resource-search").value);
  const topic = $("#topic-filter").value;
  const audience = $("#audience-filter").value;
  const age = $("#age-filter").value;
  const sort = $("#resource-sort").value;
  const filtered = state.resources.filter((item) => {
    const haystack = normalize([item.title, item.owner_name, item.topics_raw, item.audience_raw, ...(item.topics || [])].join(" "));
    return (!query || haystack.includes(query))
      && (!topic || (item.topics || []).includes(topic))
      && (!audience || (item.audience || []).includes(audience))
      && (!age || (item.age_groups || []).includes(age));
  });
  filtered.sort((a, b) => {
    if (sort === "za") return collator.compare(b.title, a.title);
    if (sort === "owner") return collator.compare(a.owner_name, b.owner_name) || collator.compare(a.title, b.title);
    return collator.compare(a.title, b.title);
  });
  return filtered;
}

function renderResources() {
  const filtered = getFilteredResources();
  const list = $("#resource-list");
  $("#resource-results-count").textContent = filtered.length;
  list.innerHTML = filtered.length
    ? filtered.slice(0, state.resourceLimit).map(resourceCard).join("")
    : `<div class="empty-state"><h3>Nenašli sme zodpovedajúci zdroj</h3><p>Skúste zmeniť tému, vek alebo publikum.</p></div>`;
  $("#load-more-resources").hidden = filtered.length <= state.resourceLimit;
}

function resourceCard(item) {
  const url = safeUrl(item.source_url);
  const topics = (item.topics || []).slice(0, 2).map((topic) => `<span class="chip topic">${escapeHtml(topic)}</span>`).join("");
  const audiences = (item.audience || []).slice(0, 2).map((audience) => `<span class="chip">${escapeHtml(audience)}</span>`).join("");
  return `
    <article class="resource-card">
      <div class="card-top"><span class="format-tag" title="${escapeHtml(item.resource_format || "Zdroj")}">${escapeHtml(item.resource_format || "Zdroj")}</span>${item.evidence_level ? `<span class="evidence-tag" title="Úroveň verejne dostupných dôkazov">${escapeHtml(item.evidence_level)}</span>` : ""}</div>
      <h3>${escapeHtml(item.title)}</h3><p class="owner">${escapeHtml(item.owner_name)}</p><div class="chips">${topics}${audiences}</div>
      <div class="card-meta"><span>Vek <b>${escapeHtml(item.age_raw || (item.age_groups || []).join(", "))}</b></span><span>Prístup <b>${escapeHtml(item.access_type || "Neuvedené")}</b></span><span>Cena <b>${escapeHtml(item.price_type || "Neuvedené")}</b></span></div>
      ${url ? `<a class="card-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Otvoriť zdroj <span aria-hidden="true">→</span></a>` : ""}
    </article>`;
}

function getFilteredAmbulances() {
  const query = normalize($("#ambulance-search").value);
  const region = $("#region-filter").value;
  const age = Number($("#ambulance-age-filter").value || 0);
  const capacity = $("#capacity-filter").value;
  const verifiedOnly = $("#verified-filter").checked;
  return state.ambulances.filter((item) => {
    const haystack = normalize([item.name, item.provider, item.city, item.address, ...(item.physicians || [])].join(" "));
    const inAge = !age || (Number(item.age_min ?? 0) <= age && Number(item.age_max ?? 18) >= age);
    const capacityMatch = !capacity
      || (capacity === "current" && !item.capacity_stale)
      || (capacity === "available" && !item.capacity_stale && ["accepting", "limited"].includes(item.capacity_status));
    return (!query || haystack.includes(query)) && (!region || item.region === region) && inAge && capacityMatch
      && (!verifiedOnly || (item.data_status !== "candidate" && !item.contact_stale));
  }).sort((a, b) => {
    const aAvailable = !a.capacity_stale && ["accepting", "limited"].includes(a.capacity_status) ? 0 : 1;
    const bAvailable = !b.capacity_stale && ["accepting", "limited"].includes(b.capacity_status) ? 0 : 1;
    return aAvailable - bAvailable || collator.compare(a.city, b.city) || collator.compare(a.name, b.name);
  });
}

function renderAmbulances() {
  const filtered = getFilteredAmbulances();
  const list = $("#ambulance-list");
  $("#ambulance-results-count").textContent = filtered.length;
  list.innerHTML = filtered.length
    ? filtered.slice(0, state.ambulanceLimit).map(ambulanceCard).join("")
    : `<div class="empty-state"><h3>Nenašli sme zodpovedajúcu ambulanciu</h3><p>Skúste zmeniť kraj, vek alebo filter kapacity.</p></div>`;
  $("#load-more-ambulances").hidden = filtered.length <= state.ambulanceLimit;
}

function todayHours(openingHours = {}) {
  const days = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];
  return openingHours[days[new Date().getDay()]] || "Čas nie je overený";
}

function capacityLabel(item) {
  if (item.capacity_stale) return { text: "Kapacita neoverená", className: "status-neutral" };
  return {
    accepting: { text: "Prijíma nových", className: "status-available" },
    limited: { text: "Obmedzená kapacita", className: "status-limited" },
    full: { text: "Aktuálne plná", className: "status-full" },
    call: { text: "Overiť telefonicky", className: "status-neutral" },
    unknown: { text: "Kapacita neoverená", className: "status-neutral" },
  }[item.capacity_status] || { text: "Kapacita neoverená", className: "status-neutral" };
}

function ambulanceCard(item) {
  const verified = item.data_status !== "candidate" && !item.contact_stale;
  const capacity = capacityLabel(item);
  const source = safeUrl(item.source_url);
  const website = safeUrl(item.website);
  const phoneHref = item.phone ? `tel:${String(item.phone).replace(/[^+\d]/g, "")}` : null;
  const emailHref = item.email ? `mailto:${encodeURIComponent(item.email)}` : null;
  const earliest = !item.capacity_stale && item.earliest_date ? `<p>Najskorší uvedený termín: <strong>${escapeHtml(new Date(`${item.earliest_date}T00:00:00`).toLocaleDateString("sk-SK"))}</strong></p>` : "";
  return `
    <article class="ambulance-card">
      <div class="ambulance-title"><div class="status-row"><span class="status-tag ${verified ? "status-verified" : "status-candidate"}">${verified ? "Overený kontakt" : "Kontakt treba preveriť"}</span><span class="status-tag ${capacity.className}">${capacity.text}</span></div><h3>${escapeHtml(item.name)}</h3><p class="location">${escapeHtml(item.city)} · ${escapeHtml(formatRegion(item.region))}</p><p>${escapeHtml(item.address || "Adresa nebola v zdroji uvedená")}</p></div>
      <div class="ambulance-contact">${item.phone ? `<p><a href="${escapeHtml(phoneHref)}">${escapeHtml(item.phone)}</a></p>` : `<p>Telefón neuvedený</p>`}${item.email ? `<p><a href="${escapeHtml(emailHref)}">${escapeHtml(item.email)}</a></p>` : `<p>E-mail neuvedený</p>`}${website ? `<p><a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">Web ambulancie →</a></p>` : ""}</div>
      <div class="ambulance-hours"><strong>Dnes</strong><p>${escapeHtml(todayHours(item.opening_hours))}</p>${earliest}${item.note_public && !item.capacity_stale ? `<p>${escapeHtml(item.note_public)}</p>` : ""}${(item.physicians || []).length ? `<p>${escapeHtml(item.physicians.slice(0, 2).join(", "))}</p>` : ""}</div>
      <div class="ambulance-actions">${phoneHref ? `<a class="button button-primary" href="${escapeHtml(phoneHref)}">Zavolať</a>` : ""}${source ? `<a class="button button-soft" href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Overiť údaje</a>` : ""}</div>
    </article>`;
}

function renderError(selector, message) {
  $(selector).innerHTML = `<div class="empty-state"><h3>Niečo sa nepodarilo</h3><p>${escapeHtml(message)}</p></div>`;
}

function setView(view, scroll = true) {
  $$('[data-view]').forEach((section) => { const active = section.dataset.view === view; section.hidden = !active; section.classList.toggle("is-active", active); });
  $$(".nav-link").forEach((button) => button.classList.toggle("is-active", button.dataset.viewLink === view));
  const hash = { resources: "zdroje", ambulances: "ambulancie", about: "o-projekte" }[view];
  if (hash) history.replaceState(null, "", `#${hash}`);
  if (scroll) $(`#${view}-view`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  closeMobileMenu();
}

function closeMobileMenu() {
  const menu = $("#mobile-menu"); menu.hidden = true; $(".menu-toggle").setAttribute("aria-expanded", "false");
}

function choiceButtons(options, key) {
  return `<div class="journey-options">${options.map((option) => `<button class="journey-option" type="button" data-journey-key="${key}" data-journey-value="${escapeHtml(option.value)}"><span>${escapeHtml(option.label)}</span><i aria-hidden="true">→</i></button>`).join("")}</div>`;
}

function journeyShell(title, description, body, step) {
  const progress = Math.round((step / 6) * 100);
  return `<div class="journey-head"><div><p class="eyebrow">Nájsť moju cestu · krok ${step} zo 6</p><h2 id="journey-title">${title}</h2></div><div class="journey-progress" aria-label="Dokončené ${progress} %"><span style="width:${progress}%"></span></div></div>${description ? `<p class="journey-description">${description}</p>` : ""}${body}<p class="journey-privacy">Bez mena, kontaktu, diagnózy a voľného zdravotného textu.</p>`;
}

function startJourney() {
  state.journey = { step: 1, answers: {} };
  renderJourney();
  const dialog = $("#journey-dialog");
  if (!dialog.open) dialog.showModal();
}

function renderJourney() {
  const content = $("#journey-content");
  const { step, answers } = state.journey;
  if (step === "crisis") return renderCrisis();
  if (step === "results") return renderJourneyResults();

  if (step === 1) content.innerHTML = journeyShell("Je dieťa práve teraz v bezprostrednom ohrození?", "Napríklad hrozí, že si ublíži, už si ublížilo, je dezorientované alebo ho nemožno bezpečne nechať samé.", choiceButtons([
    { value: "information", label: "Nie, hľadám informácie a orientáciu" },
    { value: "soon", label: "Nie je v bezprostrednom ohrození, ale pomoc potrebujeme čoskoro" },
    { value: "immediate", label: "Áno alebo si nie som istý/istá" },
  ], "urgency"), 1);
  else if (step === 2) content.innerHTML = journeyShell("Koľko má dieťa rokov?", "Stačí široká veková skupina.", choiceButtons(JOURNEY.ages, "age"), 2);
  else if (step === 3) content.innerHTML = journeyShell("Pre koho má byť pomoc určená?", "Podľa toho vyberieme materiály písané správnym jazykom.", choiceButtons(JOURNEY.audiences, "audience"), 3);
  else if (step === 4) content.innerHTML = journeyShell("Čo situáciu vystihuje najlepšie?", "Nejde o diagnózu. Vyberte len všeobecnú tému, ktorá je najbližšie.", choiceButtons(JOURNEY.topics, "topic"), 4);
  else if (step === 5) content.innerHTML = journeyShell("Akú pomoc hľadáte?", "Môžete začať materiálmi alebo rovno kontaktom na odbornú pomoc.", choiceButtons([
    { value: "materials", label: "Najprv zrozumiteľné materiály a postup" },
    { value: "ambulance", label: "Kontakt na detskú psychiatrickú ambulanciu" },
    { value: "either", label: "Oboje – ukážte mi najlepšiu cestu" },
  ], "supportType"), 5);
  else if (step === 6) {
    const regions = uniqueSorted(state.ambulances.map((item) => item.region)).filter((region) => region !== "Celé Slovensko");
    content.innerHTML = journeyShell("Kde hľadáte pomoc?", "Kraj používame iba na zoradenie ambulancií a anonymné meranie nedostatku služieb.", `<div class="journey-form"><label><span>Kraj</span><select id="journey-region"><option value="Celé Slovensko">Celé Slovensko</option>${regions.map((region) => `<option value="${escapeHtml(region)}">${escapeHtml(formatRegion(region))}</option>`).join("")}</select></label><label><span>Ako ďaleko môžete cestovať?</span><select id="journey-radius"><option value="25">Do 25 km</option><option value="50" selected>Do 50 km</option><option value="100">Do 100 km</option><option value="300">Celé Slovensko</option></select></label><label class="sr-honeypot" aria-hidden="true">Web<input id="journey-website" tabindex="-1" autocomplete="off" /></label><button class="button button-primary button-large" type="button" id="journey-finish">Ukázať moju cestu →</button></div>`, 6);
    $("#journey-finish").addEventListener("click", () => {
      answers.region = $("#journey-region").value; answers.radiusKm = Number($("#journey-radius").value); answers.website = $("#journey-website").value; state.journey.step = "results"; renderJourney();
    });
  }

  $$('[data-journey-key]', content).forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.journeyKey; const value = button.dataset.journeyValue;
    if (key === "urgency" && value === "immediate") state.journey.step = "crisis";
    else { answers[key] = value; state.journey.step += 1; }
    renderJourney();
  }));
}

function renderCrisis() {
  $("#journey-content").innerHTML = `<div class="crisis-panel"><p class="eyebrow">Konajte teraz</p><h2 id="journey-title">Bezpečie má prednosť pred dotazníkom.</h2><p>Nenechávajte dieťa osamote. Ak hrozí bezprostredné ublíženie, volajte tiesňovú linku alebo zdravotnú záchrannú službu.</p><div class="crisis-actions"><a class="button button-crisis button-large" href="tel:112">Volať 112</a><a class="button button-crisis-soft button-large" href="tel:155">Volať 155</a></div><div class="crisis-help"><strong>Linka dôvery Nezábudka</strong><p>Dospelý môže zavolať na <a href="tel:+421800800566">0800 800 566</a>.</p></div><p class="journey-privacy">Túto odpoveď neukladáme do analytiky.</p></div>`;
}

function journeyMatches() {
  const answers = state.journey.answers;
  const age = JOURNEY.ages.find((item) => item.value === answers.age);
  const audience = JOURNEY.audiences.find((item) => item.value === answers.audience);
  const topic = JOURNEY.topics.find((item) => item.value === answers.topic);
  const resources = state.resources.map((item) => {
    let score = 0;
    if ((item.age_groups || []).includes(answers.age)) score += 4;
    if ((item.audience || []).includes(answers.audience)) score += 4;
    if ((item.topics || []).includes(answers.topic)) score += 6;
    if (item.hub_priority?.toLowerCase().includes("jadro")) score += 1;
    return { item, score };
  }).filter((entry) => entry.score >= 6).sort((a, b) => b.score - a.score || collator.compare(a.item.title, b.item.title)).map((entry) => entry.item);
  const ambulances = state.ambulances.filter((item) => {
    const inAge = !age || (Number(item.age_min ?? 0) <= age.sample && Number(item.age_max ?? 18) >= age.sample);
    const inRegion = answers.region === "Celé Slovensko" || item.region === answers.region;
    return inAge && inRegion;
  }).sort((a, b) => {
    const aAvailable = !a.capacity_stale && ["accepting", "limited"].includes(a.capacity_status) ? 0 : 1;
    const bAvailable = !b.capacity_stale && ["accepting", "limited"].includes(b.capacity_status) ? 0 : 1;
    const aVerified = a.data_status !== "candidate" && !a.contact_stale ? 0 : 1;
    const bVerified = b.data_status !== "candidate" && !b.contact_stale ? 0 : 1;
    return aAvailable - bAvailable || aVerified - bVerified || collator.compare(a.city, b.city);
  });
  return { age, audience, topic, resources, ambulances };
}

function compactResource(item) {
  const url = safeUrl(item.source_url);
  return `<article class="journey-result-card"><span class="format-tag">${escapeHtml(item.resource_format || "Zdroj")}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.owner_name)}</p>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Otvoriť zdroj →</a>` : ""}</article>`;
}

function compactAmbulance(item) {
  const capacity = capacityLabel(item);
  const phoneHref = item.phone ? `tel:${String(item.phone).replace(/[^+\d]/g, "")}` : null;
  return `<article class="journey-result-card"><span class="status-tag ${capacity.className}">${capacity.text}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.city)} · ${escapeHtml(formatRegion(item.region))}</p>${phoneHref ? `<a href="${escapeHtml(phoneHref)}">${escapeHtml(item.phone)} →</a>` : `<button type="button" data-go-ambulances>Zobraziť v adresári →</button>`}</article>`;
}

function renderJourneyResults() {
  const { resources, ambulances, age, audience, topic } = journeyMatches();
  const answers = state.journey.answers;
  const showResources = answers.supportType !== "ambulance";
  const showAmbulances = answers.supportType !== "materials";
  const warning = answers.urgency === "soon" || topic?.demand === "self_harm" ? `<div class="journey-warning"><strong>Ak sa situácia zhorší alebo vznikne bezprostredné ohrozenie, volajte 112 alebo 155.</strong></div>` : "";
  $("#journey-content").innerHTML = `<div class="journey-results"><p class="eyebrow">Vaša odporúčaná cesta</p><h2 id="journey-title">Začnite týmito krokmi</h2><p>Výsledky sme zoradili pre: ${escapeHtml(age?.label || "dieťa")}, ${escapeHtml(audience?.label.toLowerCase() || "rodiča")}, téma ${escapeHtml(topic?.label.toLowerCase() || "všeobecná podpora")}.</p>${warning}${showResources ? `<section><div class="journey-section-head"><h3>1. Zrozumiteľné materiály</h3><span>${resources.length} vhodných zdrojov</span></div><div class="journey-result-grid">${resources.slice(0, 3).map(compactResource).join("") || `<p>Nenašiel sa presný materiál. Otvorte celú knižnicu zdrojov.</p>`}</div></section>` : ""}${showAmbulances ? `<section><div class="journey-section-head"><h3>${showResources ? "2." : "1."} Kontakty na odbornú pomoc</h3><span>${ambulances.length} ambulancií v oblasti</span></div><div class="journey-result-grid">${ambulances.slice(0, 4).map(compactAmbulance).join("") || `<p>V zvolenom kraji zatiaľ nemáme zodpovedajúci kontakt. Skúste celé Slovensko.</p>`}</div></section>` : ""}<div class="journey-result-actions">${showAmbulances ? `<button class="button button-primary" type="button" data-show-all-ambulances>Zobraziť celý adresár</button>` : `<button class="button button-primary" type="button" data-show-all-resources>Zobraziť všetky zdroje</button>`}<button class="button button-soft" type="button" data-restart-journey>Začať odznova</button></div><p class="journey-privacy">Do anonymnej štatistiky odošleme iba kraj, široký vek, všeobecnú tému, typ pomoci a počet výsledkov.</p></div>`;

  recordDemand({ region: answers.region, ageBand: age?.demand, radiusKm: answers.radiusKm, resultCount: Math.min(ambulances.length, 100), topic: topic?.demand, audience: audience?.demand, supportType: answers.supportType, urgency: answers.urgency === "information" ? "information" : "soon", source: "guided_journey", website: answers.website });
  $$('[data-go-ambulances], [data-show-all-ambulances]').forEach((button) => button.addEventListener("click", () => {
    $("#journey-dialog").close(); setView("ambulances");
    if (answers.region !== "Celé Slovensko") $("#region-filter").value = answers.region;
    if (age) $("#ambulance-age-filter").value = String(age.sample);
    renderAmbulances();
  }));
  $("[data-show-all-resources]")?.addEventListener("click", () => { $("#journey-dialog").close(); setView("resources"); });
  $("[data-restart-journey]").addEventListener("click", startJourney);
}

async function recordDemand(payload) {
  const signature = JSON.stringify(payload);
  if (sessionStorage.getItem("journey-demand") === signature) return;
  try {
    const result = await fetch("/api/demand", { method: "POST", headers: { "Content-Type": "application/json" }, body: signature });
    if (result.ok) sessionStorage.setItem("journey-demand", signature);
  } catch { /* Analytics never blocks results. */ }
}

function openCapacityInfo() {
  $("#capacity-content").innerHTML = `<p class="eyebrow">Pre ambulancie</p><h2 id="capacity-title">Aktualizácia kapacity</h2><p>Otvorte osobný odkaz, ktorý sme poslali vašej ambulancii. Nevyžaduje heslo a neobsahuje údaje o pacientoch.</p><div class="portal-note">Ak odkaz ešte nemáte, kontaktujte prevádzkovateľa projektu. Každá ambulancia dostane vlastný bezpečný odkaz.</div>`;
  $("#capacity-dialog").showModal();
}

async function loadCapacityPortal(externalId, token) {
  const dialog = $("#capacity-dialog");
  $("#capacity-content").innerHTML = `<div class="portal-loading"><span></span><p>Načítavam ambulanciu…</p></div>`;
  if (!dialog.open) dialog.showModal();
  try {
    const response = await fetch(`/api/capacity?ambulance=${encodeURIComponent(externalId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Ambulancia sa nenašla");
    renderCapacityForm(await response.json(), token);
  } catch (error) {
    $("#capacity-content").innerHTML = `<p class="eyebrow">Odkaz nie je dostupný</p><h2 id="capacity-title">Ambulanciu sa nepodarilo načítať</h2><p>${escapeHtml(error.message)}</p>`;
  }
}

function renderCapacityForm(item, token) {
  const currentStatus = item.capacity_status || "unknown";
  const today = new Date().toISOString().slice(0, 10);
  $("#capacity-content").innerHTML = `<p class="eyebrow">Bezpečný prístup pre ambulanciu</p><h2 id="capacity-title">${escapeHtml(item.name)}</h2><p>${escapeHtml(item.city)} · ${escapeHtml(formatRegion(item.region))}. Aktualizácia bude verejne platná 14 dní.</p><form id="capacity-form" class="capacity-form"><label><span>Aktuálny stav</span><select id="capacity-status" required><option value="accepting" ${currentStatus === "accepting" ? "selected" : ""}>Prijímame nových pacientov</option><option value="limited" ${currentStatus === "limited" ? "selected" : ""}>Máme iba obmedzenú kapacitu</option><option value="full" ${currentStatus === "full" ? "selected" : ""}>Aktuálne neprijímame</option><option value="call" ${currentStatus === "call" ? "selected" : ""}>Dostupnosť treba overiť telefonicky</option><option value="unknown" ${currentStatus === "unknown" ? "selected" : ""}>Kapacitu teraz nevieme potvrdiť</option></select></label><div class="capacity-row"><label><span>Najbližší možný termín</span><input id="capacity-date" type="date" min="${today}" value="${escapeHtml(item.earliest_date && item.earliest_date >= today ? item.earliest_date : "")}" /></label><label><span>Odhad voľných miest do 30 dní</span><input id="capacity-slots" type="number" min="0" max="99" value="${item.slots_30d ?? ""}" placeholder="Nepovinné" /></label></div><label><span>Krátka verejná poznámka</span><textarea id="capacity-note" maxlength="240" placeholder="Napr. objednávanie iba telefonicky">${escapeHtml(item.note_public || "")}</textarea></label><label class="confirm-field"><input id="capacity-confirm-contacts" type="checkbox" /><span>Potvrdzujem, že verejné kontaktné údaje ambulancie sú stále aktuálne.</span></label><div id="capacity-message" role="status"></div><button class="button button-primary button-large" type="submit">Uložiť kapacitu</button><p class="journey-privacy">Nezadávajte mená ani informácie o pacientoch.</p></form>`;
  $("#capacity-form").addEventListener("submit", (event) => submitCapacity(event, item.external_id, token));
}

async function submitCapacity(event, externalId, token) {
  event.preventDefault();
  const form = event.currentTarget; const button = $("button[type=submit]", form); const message = $("#capacity-message");
  button.disabled = true; button.textContent = "Ukladám…"; message.textContent = "";
  try {
    const response = await fetch("/api/capacity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ambulance: externalId, token, status: $("#capacity-status").value, earliestDate: $("#capacity-date").value, slots30d: $("#capacity-slots").value, note: $("#capacity-note").value, confirmContacts: $("#capacity-confirm-contacts").checked }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Aktualizáciu sa nepodarilo uložiť");
    message.className = "portal-success"; message.textContent = "Kapacita bola uložená. Verejný stav je platný 14 dní.";
    history.replaceState(null, "", `${location.pathname}#ambulancie`);
    await loadData();
  } catch (error) { message.className = "portal-error"; message.textContent = error.message; }
  finally { button.disabled = false; button.textContent = "Uložiť kapacitu"; }
}

function parseCapacityLink() {
  const match = location.hash.match(/^#kapacita\/([^/]+)\/([^/]+)$/);
  if (!match) return false;
  loadCapacityPortal(decodeURIComponent(match[1]), decodeURIComponent(match[2]));
  return true;
}

function bindEvents() {
  $$('[data-view-link]').forEach((button) => button.addEventListener("click", (event) => { event.preventDefault(); setView(button.dataset.viewLink); }));
  ["#resource-search", "#topic-filter", "#audience-filter", "#age-filter", "#resource-sort"].forEach((selector) => $(selector).addEventListener("input", () => { state.resourceLimit = 12; renderResources(); }));
  ["#ambulance-search", "#region-filter", "#ambulance-age-filter", "#capacity-filter", "#verified-filter"].forEach((selector) => $(selector).addEventListener("input", () => { state.ambulanceLimit = 15; renderAmbulances(); }));
  $("#clear-resource-filters").addEventListener("click", () => { $("#resource-search").value = ""; $("#topic-filter").value = ""; $("#audience-filter").value = ""; $("#age-filter").value = ""; $("#resource-sort").value = "az"; state.resourceLimit = 12; renderResources(); });
  $("#clear-ambulance-filters").addEventListener("click", () => { $("#ambulance-search").value = ""; $("#region-filter").value = ""; $("#ambulance-age-filter").value = ""; $("#capacity-filter").value = ""; $("#verified-filter").checked = false; state.ambulanceLimit = 15; renderAmbulances(); });
  $("#load-more-resources").addEventListener("click", () => { state.resourceLimit += 12; renderResources(); });
  $("#load-more-ambulances").addEventListener("click", () => { state.ambulanceLimit += 15; renderAmbulances(); });
  $$('[data-open-journey]').forEach((button) => button.addEventListener("click", startJourney));
  $$('[data-close-journey]').forEach((button) => button.addEventListener("click", () => $("#journey-dialog").close()));
  $("#journey-dialog").addEventListener("click", (event) => { if (event.target === $("#journey-dialog")) $("#journey-dialog").close(); });
  $$('[data-open-capacity]').forEach((button) => button.addEventListener("click", openCapacityInfo));
  $$('[data-close-capacity]').forEach((button) => button.addEventListener("click", () => $("#capacity-dialog").close()));
  $("#capacity-dialog").addEventListener("click", (event) => { if (event.target === $("#capacity-dialog")) $("#capacity-dialog").close(); });
  $(".menu-toggle").addEventListener("click", (event) => { const menu = $("#mobile-menu"); menu.hidden = !menu.hidden; event.currentTarget.setAttribute("aria-expanded", String(!menu.hidden)); });
}

bindEvents();
const capacityLink = parseCapacityLink();
const initialHash = location.hash.replace("#", "");
if (!capacityLink) setView({ ambulancie: "ambulances", "o-projekte": "about" }[initialHash] || "resources", false);
loadData();
