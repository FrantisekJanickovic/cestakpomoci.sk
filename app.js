const state = {
  resources: [],
  ambulances: [],
  resourceLimit: 12,
  ambulanceLimit: 15,
};

const collator = new Intl.Collator("sk", { sensitivity: "base" });
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

function populateSelect(id, values) {
  const select = $(id);
  values.forEach((value) => {
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

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><h3>Nenašli sme zodpovedajúci zdroj</h3><p>Skúste zmeniť tému, vek alebo publikum.</p></div>`;
  } else {
    list.innerHTML = filtered.slice(0, state.resourceLimit).map(resourceCard).join("");
  }
  $("#load-more-resources").hidden = filtered.length <= state.resourceLimit;
}

function resourceCard(item) {
  const url = safeUrl(item.source_url);
  const topics = (item.topics || []).slice(0, 2).map((topic) => `<span class="chip topic">${escapeHtml(topic)}</span>`).join("");
  const audiences = (item.audience || []).slice(0, 2).map((audience) => `<span class="chip">${escapeHtml(audience)}</span>`).join("");
  return `
    <article class="resource-card">
      <div class="card-top">
        <span class="format-tag" title="${escapeHtml(item.resource_format || "Zdroj")}">${escapeHtml(item.resource_format || "Zdroj")}</span>
        ${item.evidence_level ? `<span class="evidence-tag" title="Úroveň verejne dostupných dôkazov">${escapeHtml(item.evidence_level)}</span>` : ""}
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="owner">${escapeHtml(item.owner_name)}</p>
      <div class="chips">${topics}${audiences}</div>
      <div class="card-meta">
        <span>Vek <b>${escapeHtml(item.age_raw || (item.age_groups || []).join(", "))}</b></span>
        <span>Prístup <b>${escapeHtml(item.access_type || "Neuvedené")}</b></span>
        <span>Cena <b>${escapeHtml(item.price_type || "Neuvedené")}</b></span>
      </div>
      ${url ? `<a class="card-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Otvoriť zdroj <span aria-hidden="true">↗</span></a>` : ""}
    </article>`;
}

function getFilteredAmbulances() {
  const query = normalize($("#ambulance-search").value);
  const region = $("#region-filter").value;
  const verifiedOnly = $("#verified-filter").checked;
  return state.ambulances.filter((item) => {
    const haystack = normalize([item.name, item.provider, item.city, item.address, ...(item.physicians || [])].join(" "));
    return (!query || haystack.includes(query))
      && (!region || item.region === region)
      && (!verifiedOnly || item.data_status !== "candidate");
  }).sort((a, b) => collator.compare(a.city, b.city) || collator.compare(a.name, b.name));
}

function renderAmbulances() {
  const filtered = getFilteredAmbulances();
  const list = $("#ambulance-list");
  $("#ambulance-results-count").textContent = filtered.length;
  list.innerHTML = filtered.length
    ? filtered.slice(0, state.ambulanceLimit).map(ambulanceCard).join("")
    : `<div class="empty-state"><h3>Nenašli sme zodpovedajúcu ambulanciu</h3><p>Skúste zmeniť mesto alebo kraj.</p></div>`;
  $("#load-more-ambulances").hidden = filtered.length <= state.ambulanceLimit;
}

function todayHours(openingHours = {}) {
  const days = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];
  const value = openingHours[days[new Date().getDay()]];
  return value || "Čas nie je overený";
}

function ambulanceCard(item) {
  const verified = item.data_status !== "candidate";
  const source = safeUrl(item.source_url);
  const website = safeUrl(item.website);
  const phoneHref = item.phone ? `tel:${String(item.phone).replace(/[^+\d]/g, "")}` : null;
  const emailHref = item.email ? `mailto:${encodeURIComponent(item.email)}` : null;
  return `
    <article class="ambulance-card">
      <div class="ambulance-title">
        <span class="status-tag ${verified ? "status-verified" : "status-candidate"}">${verified ? "Overený kontakt" : "Čaká na overenie"}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p class="location">${escapeHtml(item.city)} · ${escapeHtml(item.region)} kraj</p>
        <p>${escapeHtml(item.address || "Adresa nebola v zdroji uvedená")}</p>
      </div>
      <div class="ambulance-contact">
        ${item.phone ? `<p><a href="${escapeHtml(phoneHref)}">${escapeHtml(item.phone)}</a></p>` : `<p>Telefón neuvedený</p>`}
        ${item.email ? `<p><a href="${escapeHtml(emailHref)}">${escapeHtml(item.email)}</a></p>` : `<p>E-mail neuvedený</p>`}
        ${website ? `<p><a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">Web ambulancie ↗</a></p>` : ""}
      </div>
      <div class="ambulance-hours">
        <strong>Dnes</strong>
        <p>${escapeHtml(todayHours(item.opening_hours))}</p>
        ${(item.physicians || []).length ? `<p>${escapeHtml(item.physicians.slice(0, 2).join(", "))}</p>` : ""}
      </div>
      <div class="ambulance-actions">
        ${phoneHref ? `<a class="button button-primary" href="${escapeHtml(phoneHref)}">Zavolať</a>` : ""}
        ${source ? `<a class="button button-soft" href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Overiť údaje</a>` : ""}
      </div>
    </article>`;
}

function renderError(selector, message) {
  $(selector).innerHTML = `<div class="empty-state"><h3>Niečo sa nepodarilo</h3><p>${escapeHtml(message)}</p></div>`;
}

function setView(view, scroll = true) {
  $$('[data-view]').forEach((section) => {
    const active = section.dataset.view === view;
    section.hidden = !active;
    section.classList.toggle("is-active", active);
  });
  $$(".nav-link").forEach((button) => button.classList.toggle("is-active", button.dataset.viewLink === view));
  const hash = { resources: "zdroje", ambulances: "ambulancie", about: "o-projekte" }[view];
  if (hash) history.replaceState(null, "", `#${hash}`);
  if (scroll) $(`#${view}-view`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  closeMobileMenu();
}

function closeMobileMenu() {
  const menu = $("#mobile-menu");
  menu.hidden = true;
  $(".menu-toggle").setAttribute("aria-expanded", "false");
}

function bindEvents() {
  $$('[data-view-link]').forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    setView(button.dataset.viewLink);
  }));

  ["#resource-search", "#topic-filter", "#audience-filter", "#age-filter", "#resource-sort"].forEach((selector) => {
    $(selector).addEventListener("input", () => { state.resourceLimit = 12; renderResources(); });
  });
  ["#ambulance-search", "#region-filter", "#verified-filter"].forEach((selector) => {
    $(selector).addEventListener("input", () => { state.ambulanceLimit = 15; renderAmbulances(); });
  });

  $("#clear-resource-filters").addEventListener("click", () => {
    $("#resource-search").value = ""; $("#topic-filter").value = ""; $("#audience-filter").value = ""; $("#age-filter").value = ""; $("#resource-sort").value = "az";
    state.resourceLimit = 12; renderResources();
  });
  $("#clear-ambulance-filters").addEventListener("click", () => {
    $("#ambulance-search").value = ""; $("#region-filter").value = ""; $("#verified-filter").checked = false;
    state.ambulanceLimit = 15; renderAmbulances();
  });
  $("#load-more-resources").addEventListener("click", () => { state.resourceLimit += 12; renderResources(); });
  $("#load-more-ambulances").addEventListener("click", () => { state.ambulanceLimit += 15; renderAmbulances(); });

  const dialog = $("#journey-dialog");
  $$('[data-open-journey]').forEach((button) => button.addEventListener("click", () => dialog.showModal()));
  $$('[data-close-journey]').forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

  $(".menu-toggle").addEventListener("click", (event) => {
    const menu = $("#mobile-menu");
    menu.hidden = !menu.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!menu.hidden));
  });
}

bindEvents();
const initialHash = location.hash.replace("#", "");
setView({ ambulancie: "ambulances", "o-projekte": "about" }[initialHash] || "resources", false);
loadData();
