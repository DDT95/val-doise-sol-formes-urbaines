(function () {
  "use strict";
  const fmt = (n, digits = 1) => n == null ? "n. d." : Number(n).toLocaleString("fr-FR", { maximumFractionDigits: digits });
  const root = document.getElementById("profileRoot");
  const dialog = document.getElementById("exportDialog");
  const params = new URLSearchParams(location.search);
  const scale = params.get("type") === "departement" ? "departement" : params.get("type") === "epci" ? "epci" : "commune";
  const selectedId = params.get("id");
  let currentProfile;

  function kpi(label, node, note = "") {
    const value = node?.value;
    const display = value == null ? '<span class="data-missing">Non disponible</span>' : `${fmt(value)}${node.unit === "%" ? " %" : node.unit ? " " + node.unit : ""}`;
    return `<div class="kpi"><small>${label}</small><strong>${display}</strong>${note ? `<span>${note}</span>` : ""}</div>`;
  }
  function section(kicker, title, content, note = "") {
    return `<section class="section"><div class="section-head"><div><small>${kicker}</small><h2>${title}</h2></div>${note ? `<p>${note}</p>` : ""}</div>${content}</section>`;
  }
  function bars(title, entries) {
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return `<article class="chart-card"><h3>${title}</h3>${entries.map(([label, value]) => `<div class="bar-row"><span>${label}</span><div class="bar-track"><i style="--pct:${value / max * 100}%"></i></div><b>${fmt(value)} ha</b></div>`).join("")}</article>`;
  }
  function timeline(series) {
    const max = Math.max(...series.map((d) => d.hectares), 1);
    return `<article class="chart-card visual-card wide-chart"><h3>Consommation annuelle d’ENAF</h3><div class="age-bars" role="img" aria-label="consommation annuelle en hectares">${series.map((d) => `<div class="age-column"><b>${fmt(d.hectares)}</b><div><i style="--height:${Math.max(4, d.hectares / max * 100)}%;--swatch:${d.annee >= 2021 ? "#e07a2f" : "#000091"}"></i></div><span>${d.annee}</span></div>`).join("")}</div><p class="method-note-small">Bleu : décennie de référence 2011-2020. Orange : période engagée depuis 2021.</p></article>`;
  }
  function render(profile) {
    currentProfile = profile;
    const isDepartment = scale === "departement";
    const isEpci = scale === "epci" && !profile.special;
    const type = isDepartment ? "SYNTHÈSE DÉPARTEMENTALE" : isEpci ? "FICHE INTERCOMMUNALE" : "FICHE COMMUNALE";
    document.title = `${profile.name} · Sol · formes urbaines · DDT 95`;
    document.getElementById("headerTitle").textContent = `${isDepartment ? "Synthèse départementale" : isEpci ? "Fiche EPCI" : "Fiche communale"} · Sol · formes urbaines`;
    const c = profile.consommation;
    const f = profile.formes;
    const fr = profile.friches;
    const usageLabels = { conso_hab: "Habitat", conso_act: "Activités", conso_mix: "Mixte", conso_infra: "Infrastructures", conso_inc: "Non déterminé" };
    const usageEntries = Object.entries(c.usages).map(([key, value]) => [usageLabels[key], value]);
    const sites = fr.sites || [];
    root.innerHTML = `<div id="report">
      <section class="report-cover"><div class="cover-kicker">${type} · SOL · FORMES URBAINES</div><h1>${profile.name}</h1><p>Comprendre ce qui a changé, les formes prises par l’urbanisation, le potentiel des friches et la trajectoire vers le zéro artificialisation nette.</p><div class="cover-meta"><span>Cerema 2011-2024 · Cartofriches 2026 · Insee 2023</span><span>DDT du Val-d’Oise</span></div></section>
      <div class="report-body">
        ${profile.perimetre_partiel ? `<p class="method-note-small">Indicateurs calculés sur les ${profile.members_covered.length} communes val-d’oisiennes de cet EPCI.</p>` : ""}
        ${section("01 · COMPRENDRE", "Quatre repères avant de lire les chiffres", `<div class="method-note"><strong>Consommation d’espace</strong> : passage d’un espace naturel, agricole ou forestier vers un usage urbain. <strong>Artificialisation</strong> : altération durable des fonctions écologiques du sol, mesurée progressivement avec l’OCS GE. <strong>Friche</strong> : site délaissé à qualifier avant tout projet. <strong>ZAN</strong> : réduire d’abord fortement les extensions, puis équilibrer artificialisation et renaturation à l’horizon 2050.</div>`)}
        ${section("02 · CE QUI A CHANGÉ", "La consommation d’espace en quatre chiffres", `<div class="kpi-grid kpi-grid-six">${kpi("Référence 2011-2020", c.reference_2011_2020)}${kpi("Depuis 2021", c.depuis_2021)}${kpi("Repère indicatif 2021-2030", c.objectif_2021_2030)}${kpi("Part du repère consommée", c.avancement_objectif)}</div>${timeline(c.serie_annuelle)}`, "Les données portent sur la consommation d’ENAF, pas encore sur le bilan net d’artificialisation.")}
        ${section("03 · SOUS QUELLE FORME", "Usages et forme résidentielle", `<div class="charts-grid visual-grid">${bars("Destination de la consommation cumulée", usageEntries)}<article class="chart-card"><h3>Repères résidentiels</h3><div class="kpi-grid">${kpi("Logements", f.logements)}${kpi("Part d’appartements", f.part_appartements)}${kpi("Part de maisons", f.part_maisons)}</div><p class="method-note-small">Ces indicateurs éclairent la forme bâtie sans résumer à eux seuls la densité, la qualité urbaine ou l’intensité d’usage.</p></article></div>`)}
        ${section("04 · RECYCLER AVANT D’ÉTENDRE", "Les friches recensées", `<div class="kpi-grid kpi-grid-six">${kpi("Sites recensés", fr.nombre)}${kpi("Surface recensée", fr.surface)}</div><div class="rank-list"><h3>Sites documentés</h3>${sites.length ? sites.slice(0, 12).map((site) => `<div class="rank-row"><span>${site.site_nom || "Site sans nom"}${site.comm_nom ? ` · ${site.comm_nom}` : ""}</span><b>${site.site_surface ? fmt(site.site_surface / 10000) + " ha" : "surface n. d."}</b></div>`).join("") : '<p class="data-missing">Aucune friche actuellement recensée dans Cartofriches.</p>'}</div><p class="method-note-small">Une friche recensée est un potentiel à expertiser : pollution, propriété, desserte, biodiversité et compatibilité avec les documents d’urbanisme restent à étudier.</p>`)}
        ${section("05 · TRAJECTOIRE ZAN", "Comment situer le territoire ?", `<div class="method-note"><strong>${fmt(c.avancement_objectif.value)} %</strong> du repère indicatif calculé pour 2021-2030 a été consommé sur les années disponibles. Ce pourcentage aide à comprendre un rythme ; il ne constitue ni un quota opposable ni l’objectif juridiquement territorialisé du document de planification. Le ZAN ne signifie pas « ne plus construire » : il invite à réutiliser l’existant, densifier avec qualité, mobiliser les friches et renaturer lorsque c’est pertinent.</div>`)}
        ${section("06 · SOURCES ET MÉTHODE", "Bien lire cette fiche", `<div class="method-note"><strong>Consommation d’espace :</strong> Cerema / DGALN, Fichiers fonciers, 2011-2024. <strong>Friches :</strong> Cartofriches, inventaire évolutif consulté en 2026. <strong>Forme résidentielle :</strong> Insee, Recensement 2023, logement. <strong>Définitions :</strong> Portail national de l’artificialisation et IGN OCS GE.<br><br><strong>Méthode :</strong> le repère 2021-2030 correspond à 50 % de la consommation observée en 2011-2020. Il est présenté à des fins pédagogiques et ne remplace pas la territorialisation réglementaire. Une absence dans Cartofriches ne prouve pas l’absence de friche. Licence Ouverte / Etalab.</div>`)}
      </div></div>`;
  }
  Promise.all([
    fetch("data/processed/sol_commune_profiles.json").then((r) => r.json()),
    fetch("data/processed/sol_epci_profiles.json").then((r) => r.json()),
    fetch("data/processed/sol_departement_profile.json").then((r) => r.json()),
  ]).then(([communes, epcis, department]) => {
    const profile = scale === "departement" ? department : scale === "epci" ? epcis[selectedId] : communes[selectedId];
    if (!profile) throw new Error("Territoire introuvable");
    render(profile);
  }).catch(() => { root.innerHTML = '<div class="loading">Territoire introuvable. Retournez à la carte et sélectionnez une commune ou un EPCI.</div>'; });

  document.getElementById("openExport").onclick = () => dialog.showModal();
  document.getElementById("closeExport").onclick = () => dialog.close();
  dialog.onclick = (event) => { if (event.target === dialog) dialog.close(); };
  document.getElementById("printProfile").onclick = () => { dialog.close(); window.print(); };
  document.getElementById("makePdf").onclick = async () => {
    dialog.close(); document.body.classList.add("exporting");
    const name = (currentProfile.name || "territoire").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    try { await html2pdf().set({ margin: 0, filename: `fiche-sol-formes-urbaines-${name}.pdf`, image: { type: "jpeg", quality: 0.96 }, html2canvas: { scale: 2, useCORS: true, letterRendering: true }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"], avoid: [".section", ".chart-card"] } }).from(document.getElementById("report")).save(); }
    finally { document.body.classList.remove("exporting"); }
  };
})();
