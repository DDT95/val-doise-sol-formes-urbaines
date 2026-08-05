(function () {
  "use strict";

  const state = {
    communes: [],
    communesByCode: new Map(),
    epcis: [],
    epcisByCode: new Map(),
    epciColors: new Map(),
    scale: "commune",
    selected: null,
    activeLayer: null,
    friches: [],
    frichesVisible: false,
  };

  const LAYERS = {
    conso_reference: { label: "ENAF consommés entre 2011 et 2020", unit: "ha", ramp: ["#eef2f9", "#3978b8", "#070047"], get: (p) => p.consommation.reference_2011_2020.value },
    conso_recente: { label: "ENAF consommés depuis 2021", unit: "ha", ramp: ["#fdf0e9", "#e07a2f", "#7a3200"], get: (p) => p.consommation.depuis_2021.value },
    zan_avancement: { label: "Part de l’enveloppe indicative consommée", unit: "%", ramp: ["#eef7ee", "#f2c94c", "#ce0500"], get: (p) => p.consommation.avancement_objectif.value },
    part_appartements: { label: "Part d’appartements", unit: "%", ramp: ["#eef7f8", "#00a7b5", "#004a52"], get: (p) => p.formes.part_appartements.value },
    friches_nombre: { label: "Friches recensées", unit: "sites", ramp: ["#f5f0e6", "#b8752a", "#5c3200"], get: (p) => p.friches.nombre.value },
    friches_surface: { label: "Surface de friches recensée", unit: "ha", ramp: ["#f3eef9", "#6f4c9b", "#2e1a4d"], get: (p) => p.friches.surface.value },
  };

  document.querySelectorAll(".layer-card[data-layer]").forEach((btn) => {
    const def = LAYERS[btn.dataset.layer];
    if (!def) return;
    btn.style.setProperty("--layer-color", def.ramp[1]);
    btn.style.setProperty("--layer-gradient", `linear-gradient(135deg, ${def.ramp[0]}, ${def.ramp[1]})`);
  });

  function pct(num, den) {
    if (num == null || !den) return null;
    return (num / den) * 100;
  }
  function htmlEsc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function fmt(v, unit) {
    if (v == null) return "Non disponible";
    const n = unit === "%" ? v.toFixed(1).replace(".", ",") + " %" : unit === "ha" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " ha" : Math.round(v).toLocaleString("fr-FR") + (unit && unit !== "%" ? " " + unit : "");
    return n;
  }

  // ---------- Map ----------
  const VDO_CENTER = [49.05, 2.15];
  const EPCI_COLORS = ["#18753c", "#6f4c9b", "#009099", "#c76524", "#d64d70", "#477a3c", "#ce0500", "#b88a16", "#45556c", "#3978b8"];
  const map = L.map("map", { zoomControl: true, minZoom: 7, maxZoom: 15 }).setView(VDO_CENTER, 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  let communesLayer, deptLayer, frichesLayer;
  const territoryTooltip = L.tooltip({ sticky: true, className: "commune-tip", direction: "top", offset: [0, -8] });

  Promise.all([
    d3.json("data/processed/departement95.geojson"),
    d3.json("data/processed/communes95.geojson"),
    d3.json("data/processed/communes95.json"),
    d3.json("data/processed/sol_commune_profiles.json"),
    d3.json("data/processed/sol_epci_profiles.json"),
    d3.json("data/processed/friches95.json"),
  ]).then(([dept95, communes95Geo, communes95, communeProfiles, epciProfiles, friches95]) => {
    deptLayer = L.geoJSON(dept95, { style: { color: "#000091", weight: 2, fill: false, opacity: 0.55 } }).addTo(map);

    state.communes = communes95.map((c) => ({ ...c, profile: communeProfiles[c.code] }));
    state.communesByCode = new Map(state.communes.map((c) => [c.code, c]));
    state.epcis = Object.values(epciProfiles);
    state.epcisByCode = new Map(state.epcis.map((e) => [e.code, e]));
    state.friches = (friches95.features || []).slice().sort((a, b) => {
      const pa = a.properties || {}, pb = b.properties || {};
      return `${pa.comm_nom || ""} ${pa.site_nom || ""}`.localeCompare(`${pb.comm_nom || ""} ${pb.site_nom || ""}`, "fr");
    });
    const fricheItems = [];
    state.friches.forEach((feature) => {
      const p = feature.properties || {};
      const tooltip = `<b>${htmlEsc(p.site_nom || feature.id)}</b><br>${htmlEsc(p.comm_nom || "Commune non renseignée")}`;
      const polygon = L.geoJSON(feature, { style: () => ({ color: "#8a4b12", weight: 1.5, fillColor: "#d88931", fillOpacity: 0.28 }) });
      const center = polygon.getBounds().getCenter();
      const point = L.circleMarker(center, { radius: 7, color: "#fff", weight: 2, fillColor: "#b8752a", fillOpacity: 1 });
      [polygon, point].forEach((layer) => {
        layer.bindTooltip(tooltip, { sticky: true });
        layer.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          window.open(`friche.html?id=${encodeURIComponent(feature.id)}`, "_blank", "noopener");
        });
        fricheItems.push(layer);
      });
    });
    frichesLayer = L.layerGroup(fricheItems);
    prepareEpciColors();

    communesLayer = L.geoJSON(communes95Geo, {
      style: () => ({ color: "#8a9bb0", weight: 0.6, fillColor: "#dce8f1", fillOpacity: 0.5 }),
      onEachFeature: (feature, layer) => {
        layer.on("click", () => selectFromMap(feature.properties.code));
        layer.on("mouseover", (event) => {
          territoryTooltip.setContent(territoryNameFromMap(feature.properties.code)).setLatLng(event.latlng).openOn(map);
        });
        layer.on("mousemove", (event) => territoryTooltip.setLatLng(event.latlng));
        layer.on("mouseout", () => map.closeTooltip(territoryTooltip));
      },
    }).addTo(map);

    document.getElementById("mapStatus").textContent = `${state.communes.length} communes chargées`;
    if (deptLayer) map.fitBounds(deptLayer.getBounds(), { padding: [24, 24], animate: false });
    applyChoropleth();
    renderEmptyState();

    const initialParams = new URLSearchParams(location.search);
    if (initialParams.get("type") === "epci" && state.epcisByCode.has(initialParams.get("id"))) {
      setMapScale("epci");
      selectEpci(initialParams.get("id"));
    } else if (initialParams.get("scale") === "epci") {
      setMapScale("epci");
    } else if (initialParams.get("type") === "commune" && state.communesByCode.has(initialParams.get("id"))) {
      selectCommune(initialParams.get("id"));
    }
  });

  function prepareEpciColors() {
    const regular = state.epcis.filter((e) => !e.special).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const special = state.epcis.filter((e) => e.special).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    [...regular, ...special].forEach((e, i) => state.epciColors.set(e.code, EPCI_COLORS[i % EPCI_COLORS.length]));
  }

  function epciForCommune(code) {
    return state.epcis.find((e) => e.members.includes(code));
  }

  function territoryNameFromMap(code) {
    if (state.scale === "commune") return state.communesByCode.get(code)?.name || code;
    return epciForCommune(code)?.name || "Territoire hors EPCI affiché";
  }

  // ---------- Choropleth ----------
  function valueForTerritoryCode(code) {
    if (!state.activeLayer) return null;
    if (state.scale === "commune") {
      const c = state.communesByCode.get(code);
      return c && c.profile ? LAYERS[state.activeLayer].get(c.profile) : null;
    }
    const epci = epciForCommune(code);
    return epci ? LAYERS[state.activeLayer].get(epci) : null;
  }

  function applyChoropleth() {
    if (!communesLayer) return;
    const layerDef = state.activeLayer ? LAYERS[state.activeLayer] : null;

    if (!layerDef) {
      communesLayer.eachLayer((layer) => {
        const code = layer.feature.properties.code;
        const isSelected = code === state.selected || (state.scale === "epci" && epciForCommune(code)?.code === state.selected);
        layer.setStyle({
          fillColor: "#dce8f1",
          fillOpacity: isSelected ? 0.5 : 0.32,
          weight: isSelected ? 2.4 : 0.6,
          color: isSelected ? "#070047" : "#8a9bb0",
        });
        if (isSelected) layer.bringToFront();
      });
      document.getElementById("mapLegend").hidden = true;
      return;
    }

    let values;
    if (state.scale === "commune") {
      values = state.communes.map((c) => (c.profile ? layerDef.get(c.profile) : null)).filter((v) => v != null);
    } else {
      values = state.epcis.filter((e) => !e.special).map((e) => layerDef.get(e)).filter((v) => v != null);
    }
    const extent = d3.extent(values);
    const colorScale = d3.scaleLinear().range(layerDef.ramp);
    colorScale.domain(extent[0] === extent[1] ? [0, extent[1] || 1] : extent);

    communesLayer.eachLayer((layer) => {
      const code = layer.feature.properties.code;
      const isSelected = code === state.selected || (state.scale === "epci" && epciForCommune(code)?.code === state.selected);
      const v = valueForTerritoryCode(code);
      const fill = v == null ? "#e4e9ec" : colorScale(v);
      layer.setStyle({
        fillColor: fill,
        fillOpacity: v == null ? 0.35 : 0.72,
        weight: isSelected ? 2.4 : 0.6,
        color: isSelected ? "#070047" : "#8a9bb0",
      });
      if (isSelected) layer.bringToFront();
    });

    const legend = document.getElementById("mapLegend");
    legend.hidden = false;
    legend.querySelector(".ramp").style.background = `linear-gradient(90deg, ${layerDef.ramp.join(",")})`;
    document.getElementById("legendTitle").textContent = layerDef.label;
    document.getElementById("legendMin").textContent = fmt(extent[0], layerDef.unit);
    document.getElementById("legendMax").textContent = fmt(extent[1], layerDef.unit);
    document.getElementById("legendNote").textContent = "Gris = donnée non disponible ou secrétisée.";
  }

  document.querySelectorAll(".layer-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.layer === "friches_nombre") {
        state.frichesVisible = !state.frichesVisible;
        btn.classList.toggle("active", state.frichesVisible);
        if (state.frichesVisible) {
          frichesLayer?.addTo(map);
          frichesLayer?.eachLayer((layer) => layer.bringToFront?.());
          document.getElementById("mapStatus").textContent = `${state.friches.length} friches affichées · cliquez sur un site pour ouvrir son volet`;
        } else {
          if (frichesLayer) map.removeLayer(frichesLayer);
          document.getElementById("detailPanel").classList.remove("open");
          renderEmptyState();
        }
        return;
      }
      const turningOff = btn.classList.contains("active");
      document.querySelectorAll(".layer-card:not([data-layer='friches_nombre'])").forEach((b) => b.classList.toggle("active", !turningOff && b === btn));
      state.activeLayer = turningOff ? null : btn.dataset.layer;
      state.selected = null;
      searchInput.value = "";
      document.getElementById("detailPanel").classList.remove("open");
      applyChoropleth();
      renderEmptyState();
    });
  });

  // ---------- Search ----------
  const searchInput = document.getElementById("searchInput");
  const searchButton = document.getElementById("searchButton");
  const searchResults = document.getElementById("searchResults");
  const territorySearchLabel = document.getElementById("territorySearchLabel");

  function renderSearchResults(query) {
    const q = query.trim().toLowerCase();
    if (!q) { searchResults.hidden = true; searchResults.innerHTML = ""; return; }
    const collection = state.scale === "epci" ? state.epcis : state.communes;
    const matches = collection.filter((item) => item.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, "fr")).slice(0, 8);
    if (!matches.length) { searchResults.hidden = true; return; }
    searchResults.innerHTML = matches.map((item) => `<button type="button" data-code="${item.code}"><b>${item.name}</b><small>${state.scale === "epci" ? (item.special ? "Commune particulière" : "EPCI") : "Commune"}</small></button>`).join("");
    searchResults.hidden = false;
    searchResults.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (state.scale === "epci") selectEpci(btn.dataset.code); else selectCommune(btn.dataset.code);
        searchResults.hidden = true;
      });
    });
  }
  searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
  searchInput.addEventListener("focus", () => renderSearchResults(searchInput.value));
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box") && !e.target.closest(".search-results")) searchResults.hidden = true;
  });
  searchButton.addEventListener("click", () => {
    const collection = state.scale === "epci" ? state.epcis : state.communes;
    const q = searchInput.value.trim().toLowerCase();
    const match = collection.find((item) => item.name.toLowerCase() === q) || collection.find((item) => item.name.toLowerCase().includes(q));
    if (match) state.scale === "epci" ? selectEpci(match.code) : selectCommune(match.code);
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchButton.click();
  });

  // ---------- Mode switch ----------
  function setMapScale(scale) {
    state.scale = scale;
    state.selected = null;
    searchInput.value = "";
    territorySearchLabel.textContent = scale === "epci" ? "Rechercher un EPCI" : "Rechercher une commune";
    searchInput.placeholder = scale === "epci" ? "Ex. Cergy-Pontoise" : "Ex. Pontoise";
    document.querySelectorAll("[data-map-scale]").forEach((b) => {
      const active = b.dataset.mapScale === scale;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    document.getElementById("detailPanel").classList.remove("open");
    applyChoropleth();
    renderEmptyState();
  }
  document.querySelectorAll("[data-map-scale]").forEach((b) => b.addEventListener("click", () => setMapScale(b.dataset.mapScale)));

  // ---------- Mobile sidebar ----------
  const sidebarEl = document.getElementById("layerSidebar");
  const mobileLayersBtn = document.getElementById("mobileLayers");
  mobileLayersBtn.addEventListener("click", () => {
    const open = sidebarEl.classList.toggle("open");
    mobileLayersBtn.setAttribute("aria-expanded", String(open));
  });

  // ---------- Reset ----------
  document.getElementById("resetView").addEventListener("click", () => {
    state.selected = null;
    searchInput.value = "";
    searchResults.hidden = true;
    sidebarEl.classList.remove("open");
    mobileLayersBtn.setAttribute("aria-expanded", "false");
    document.getElementById("detailPanel").classList.remove("open");
    if (deptLayer) map.fitBounds(deptLayer.getBounds(), { padding: [24, 24], animate: false });
    else map.setView(VDO_CENTER, 10, { animate: false });
    applyChoropleth();
    renderEmptyState();
  });

  // ---------- Comprendre dialog ----------
  const comprendreDialog = document.getElementById("comprendreDialog");
  document.getElementById("openComprendre3")?.addEventListener("click", () => comprendreDialog.showModal());
  comprendreDialog.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", () => comprendreDialog.close()));
  comprendreDialog.addEventListener("click", (e) => { if (e.target === comprendreDialog) comprendreDialog.close(); });

  function openTerritoryData() {
    if (!state.selected) {
      window.open("fiche.html?type=departement", "_blank", "noopener");
      return;
    }
    const url = state.scale === "epci" ? `fiche.html?type=epci&id=${encodeURIComponent(state.selected)}` : `fiche.html?type=commune&id=${encodeURIComponent(state.selected)}`;
    window.open(url, "_blank", "noopener");
  }
  ["openData", "openDataTop"].forEach((id) => document.getElementById(id)?.addEventListener("click", openTerritoryData));

  // ---------- Selection ----------
  function selectFromMap(code) {
    if (state.scale === "commune") { selectCommune(code); return; }
    const epci = epciForCommune(code);
    if (epci) selectEpci(epci.code);
  }

  function selectCommune(code) {
    state.scale = "commune";
    state.selected = code;
    const c = state.communesByCode.get(code);
    if (c) {
      searchInput.value = c.name;
      map.setView([c.lat, c.lon], Math.max(map.getZoom(), 11), { animate: false });
      document.getElementById("mapStatus").textContent = `${c.name} · profil affiché`;
    }
    applyChoropleth();
    renderDetail(code);
  }

  function selectEpci(code) {
    const epci = state.epcisByCode.get(code);
    if (!epci) return;
    state.scale = "epci";
    state.selected = code;
    searchInput.value = epci.name;
    const visibleLayers = [];
    communesLayer.eachLayer((layer) => { if (epci.members.includes(layer.feature.properties.code)) visibleLayers.push(layer); });
    if (visibleLayers.length) map.fitBounds(L.featureGroup(visibleLayers).getBounds(), { padding: [45, 45], animate: false, maxZoom: 11 });
    document.getElementById("mapStatus").textContent = `${epci.name} · profil affiché`;
    applyChoropleth();
    renderDetail(code);
  }

  // ---------- Detail panel ----------
  function renderFricheDetail(feature) {
    const p = feature.properties || {};
    const detailPanel = document.getElementById("detailPanel");
    const detailContent = document.getElementById("detailContent");
    const area = p.site_surface == null ? null : p.site_surface / 10000;
    const profileUrl = `friche.html?id=${encodeURIComponent(feature.id)}`;
    const pollution = p.sol_pollution_existe && p.sol_pollution_existe !== "inconnu" ? p.sol_pollution_existe : "Non renseignée";
    const status = p.site_statut && p.site_statut !== "inconnu" ? p.site_statut : "Non renseigné";
    const occupation = p.site_occupation && p.site_occupation !== "inconnu" ? p.site_occupation : "Non renseignée";
    detailContent.innerHTML = `
      <span class="detail-tag">FRICHE · CARTOFRICHES</span>
      <h2>${htmlEsc(p.site_nom || feature.id)}</h2>
      <p class="subtitle">${htmlEsc(p.comm_nom || "Commune non renseignée")} · site recensé</p>
      <div class="kpi-grid">
        <div class="kpi-tile"><small>Surface du site</small><strong>${area == null ? "Non renseignée" : fmt(area, "ha")}</strong></div>
        <div class="kpi-tile"><small>Type de friche</small><strong>${htmlEsc(p.site_type || "Non renseigné")}</strong></div>
        <div class="kpi-tile"><small>Statut</small><strong>${htmlEsc(status)}</strong></div>
        <div class="kpi-tile"><small>Occupation</small><strong>${htmlEsc(occupation)}</strong></div>
      </div>
      <div class="section-block">
        <strong>Urbanisme et état du site</strong>
        <div class="kpi-grid">
          <div class="kpi-tile"><small>Zonage</small><strong>${htmlEsc(p.urba_zone_lib || p.urba_zone_type || "Non renseigné")}</strong></div>
          <div class="kpi-tile"><small>Pollution des sols</small><strong>${htmlEsc(pollution)}</strong></div>
          <div class="kpi-tile"><small>Bâtiments recensés</small><strong>${p.bati_nombre == null ? "Non renseigné" : Math.round(p.bati_nombre).toLocaleString("fr-FR")}</strong></div>
          <div class="kpi-tile"><small>Source</small><strong>${htmlEsc(p.source_nom || p.source_producteur || "Cartofriches")}</strong></div>
        </div>
      </div>
      <a class="profile-link" href="${profileUrl}" target="_blank" rel="noopener">Voir la fiche complète et le PDF <span>↗</span></a>
      <p class="detail-method">Une friche recensée constitue un potentiel à qualifier. La présence dans Cartofriches ne vaut ni diagnostic de pollution, ni décision de constructibilité.</p>`;
    detailPanel.classList.add("open");
  }

  function renderDetail(code) {
    const isEpci = state.scale === "epci";
    const p = isEpci ? state.epcisByCode.get(code) : state.communesByCode.get(code)?.profile;
    const detailPanel = document.getElementById("detailPanel");
    const detailContent = document.getElementById("detailContent");
    if (!p) { detailPanel.classList.remove("open"); return; }
    const name = isEpci ? p.name : state.communesByCode.get(code).name;
    const territoryType = isEpci && !p.special ? "EPCI" : "Commune";
    const profileUrl = isEpci ? `fiche.html?type=epci&id=${encodeURIComponent(code)}` : `fiche.html?type=commune&id=${encodeURIComponent(code)}`;

    const reference = p.consommation.reference_2011_2020.value;
    const recent = p.consommation.depuis_2021.value;
    const target = p.consommation.objectif_2021_2030.value;
    const progress = p.consommation.avancement_objectif.value;
    const friches = p.friches.nombre.value;
    const fricheArea = p.friches.surface.value;

    const partialNote = isEpci && p.perimetre_partiel ? `<div class="flag-note">Indicateurs calculés sur les ${p.members_covered.length} communes val-d’oisiennes de cet EPCI (périmètre complet : ${p.members.length} communes, débordant sur un département voisin).</div>` : "";

    detailContent.innerHTML = `
      <span class="detail-tag">${territoryType.toUpperCase()} · SOL · FORMES URBAINES</span>
      <h2>${name}</h2>
      <p class="subtitle">Consommation d’espace, friches et trajectoire ZAN</p>
      ${partialNote}
      <div class="kpi-grid">
        <div class="kpi-tile"><small>ENAF consommés 2011-2020</small><strong>${fmt(reference, "ha")}</strong></div>
        <div class="kpi-tile"><small>ENAF consommés depuis 2021</small><strong>${fmt(recent, "ha")}</strong></div>
        <div class="kpi-tile${progress != null && progress > 100 ? " warn" : ""}"><small>Enveloppe indicative consommée</small><strong>${fmt(progress, "%")}</strong></div>
        <div class="kpi-tile"><small>Repère indicatif 2021-2030</small><strong>${fmt(target, "ha")}</strong></div>
      </div>
      <div class="section-block">
        <strong>Recycler avant d’étendre</strong>
        <div class="kpi-grid">
          <div class="kpi-tile"><small>Friches recensées</small><strong>${fmt(friches, "sites")}</strong><em>Inventaire Cartofriches</em></div>
          <div class="kpi-tile"><small>Surface recensée</small><strong>${fmt(fricheArea, "ha")}</strong><em>Potentiel à qualifier, pas automatiquement constructible</em></div>
        </div>
      </div>
      <a class="profile-link" href="${profileUrl}" target="_blank" rel="noopener">Voir la fiche ${isEpci ? "EPCI" : "communale"} complète et le PDF <span>↗</span></a>
      <p class="detail-method">Sources : Cerema / DGALN, Fichiers fonciers 2011-2024 ; Cartofriches ; Insee 2023. Le repère ZAN est pédagogique et ne remplace pas les objectifs territorialisés des documents de planification.</p>
    `;
    detailPanel.classList.add("open");
  }

  function renderEmptyState() {
    document.getElementById("detailPanel").classList.remove("open");
    document.getElementById("mapStatus").textContent = `Val-d’Oise · sélectionnez ${state.scale === "epci" ? "un EPCI" : "une commune"} pour comprendre sa trajectoire foncière`;
  }

  document.getElementById("closeDetail").addEventListener("click", () => document.getElementById("detailPanel").classList.remove("open"));
})();
