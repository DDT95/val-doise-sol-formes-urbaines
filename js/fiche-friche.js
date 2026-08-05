(function () {
  "use strict";
  const root = document.getElementById("profileRoot");
  const dialog = document.getElementById("exportDialog");
  const id = decodeURIComponent(new URLSearchParams(location.search).get("id") || "");
  let currentName = "friche";

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const present = (value) => value !== null && value !== undefined && value !== "" && value !== "inconnu" && value !== "non renseigné";
  const fmt = (value, digits = 1) => Number(value).toLocaleString("fr-FR", { maximumFractionDigits: digits });
  const yesNo = (value) => value === "oui" ? "Oui" : value === "non" ? "Non" : value;
  const parseList = (value) => {
    if (!present(value)) return [];
    let text = Array.isArray(value) ? value.join("") : String(value);
    text = text.trim().replace(/^\{/, "").replace(/\}$/, "").replace(/^\[/, "").replace(/\]$/, "");
    return text.split(/\s*[;,]\s*(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((part) => part.trim().replace(/^['\"]+|['\"]+$/g, "").replace(/\"\"/g, "\"")).filter(Boolean);
  };
  function item(label, value, unit = "") {
    if (!present(value)) return "";
    const text = String(value);
    const valueClass = text.length > 60 ? " kpi-long" : text.length > 28 ? " kpi-text" : "";
    return `<div class="kpi${valueClass}"><small>${esc(label)}</small><strong>${esc(value)}${unit}</strong></div>`;
  }
  function listBlock(label, values, variant = "") {
    const list = parseList(values);
    if (!list.length) return "";
    const limit = variant === "cadastre" ? 24 : list.length;
    const visible = list.slice(0, limit);
    return `<div class="rank-list friche-rank-list ${variant}"><h3>${esc(label)} <small>${list.length}</small></h3>${visible.map((value) => `<div class="rank-row"><span>${esc(value)}</span></div>`).join("")}${list.length > limit ? `<p class="detail-list-more">+ ${list.length - limit} autres références conservées dans la source Cartofriches</p>` : ""}</div>`;
  }
  function section(kicker, title, content, note = "") {
    return `<section class="section"><div class="section-head"><div><small>${kicker}</small><h2>${title}</h2></div>${note ? `<p>${note}</p>` : ""}</div>${content}</section>`;
  }
  function sourceLink(url, label) {
    return present(url) ? `<a class="profile-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} <span>↗</span></a>` : "";
  }
  function render(feature) {
    const p = feature.properties || {};
    currentName = p.site_nom || feature.id;
    const communeName = p.comm_nom || "Val-d’Oise";
    const coverTitle = currentName.length > 72 ? `Friche à ${communeName}` : currentName;
    const showSourceName = coverTitle !== currentName;
    document.title = `${currentName} · Fiche friche · DDT 95`;
    const geometryType = feature.geometry?.type === "MultiPolygon" ? "Emprise composée de plusieurs polygones" : feature.geometry?.type === "Polygon" ? "Emprise polygonale" : "Géométrie ponctuelle ou non renseignée";
    const surfaceHa = present(p.site_surface) ? fmt(p.site_surface / 10000) : null;
    const unitHa = present(p.unite_fonciere_surface) ? fmt(p.unite_fonciere_surface / 10000) : null;
    const buildingArea = present(p.bati_surface) ? `${fmt(p.bati_surface, 0)} m²` : null;
    const footprint = present(p.emprise_sol_bati) ? `${fmt(p.emprise_sol_bati, 0)} m²` : null;
    const environmental = present(p.zonage_enviro) ? String(p.zonage_enviro).replaceAll("_", " ") : null;
    root.innerHTML = `<div id="report">
      <section class="report-cover friche-cover"><div class="cover-kicker">FICHE DE FRICHE · SOL · FORMES URBAINES</div><h1>${esc(coverTitle)}</h1>${showSourceName ? `<p class="cover-source"><span>INTITULÉ CARTOFRICHES</span>${esc(currentName)}</p>` : ""}<p>${esc(communeName)} · portrait documentaire du site recensé dans Cartofriches.</p><div class="cover-meta"><span>Identifiant Cartofriches : ${esc(feature.id)}</span><span>DDT du Val-d’Oise</span></div></section>
      <div class="report-body">
        ${section("01 · IDENTITÉ", "Le site en un coup d’œil", `<div class="kpi-grid kpi-grid-six">${item("Commune", p.comm_nom)}${item("Code Insee", p.comm_insee)}${item("Type de friche", p.site_type)}${item("Statut", p.site_statut)}${item("Occupation actuelle", p.site_occupation)}${item("Adresse", p.site_adresse)}</div>${showSourceName ? `<div class="source-name"><small>INTITULÉ COMPLET DANS CARTOFRICHES</small><p>${esc(currentName)}</p></div>` : ""}<div class="method-note"><strong>Lecture :</strong> Cartofriches rassemble des informations provenant de plusieurs producteurs. Les champs non renseignés sont conservés comme tels et ne sont jamais interprétés comme une absence certaine.</div>`)}
        ${section("02 · EMPRISE", "Surfaces et bâti documentés", `<div class="kpi-grid kpi-grid-six">${item("Surface du site", surfaceHa, " ha")}${item("Surface de l’unité foncière", unitHa, " ha")}${item("Nombre de bâtiments", p.bati_nombre)}${item("Surface bâtie", buildingArea)}${item("Emprise au sol bâtie", footprint)}${item("Taux artificialisé déclaré", p.taux_artif_ff, present(p.taux_artif_ff) ? " %" : "")}</div><p class="method-note-small">${esc(geometryType)}. Les surfaces proviennent de l’inventaire et peuvent correspondre à des périmètres de nature différente.</p>`)}
        ${section("03 · URBANISME", "Zonage et vocation", `<div class="kpi-grid kpi-grid-six">${item("Document d’urbanisme", p.urba_doc_type)}${item("Type de zone", p.urba_zone_type)}${item("Libellé de zone", p.urba_zone_lib)}${item("Forme dominante", p.urba_zone_formdomi_txt)}${item("Zone d’activités", yesNo(p.zone_activites))}${item("Vocation déclarée", p.site_vocadomi)}</div>`)}
        ${section("04 · ÉTAT DU SITE", "Pollution, bâti et environnement", `<div class="kpi-grid kpi-grid-six">${item("Pollution des sols", p.sol_pollution_existe)}${item("Origine de la pollution", p.sol_pollution_origine)}${item("Pollution du bâti", p.bati_pollution)}${item("État du bâti", p.bati_etat)}${item("Vacance du bâti", p.bati_vacance)}${item("Sécurisation", p.site_securite)}${item("Monument historique", yesNo(p.monuhisto))}${item("À moins de 500 m d’un monument", yesNo(p.monuhisto500))}${item("Contexte environnemental", environmental)}</div>${present(p.sol_pollution_commentaire) ? `<div class="method-note"><strong>Commentaire pollution :</strong> ${esc(p.sol_pollution_commentaire)}</div>` : ""}`)}
        ${section("05 · ACCESSIBILITÉ", "Desserte connue", `<div class="kpi-grid kpi-grid-six">${item("Distance à la route", p.desserte_distance_route, present(p.desserte_distance_route) ? " m" : "")}${item("Distance au ferroviaire", p.desserte_distance_ferroviaire, present(p.desserte_distance_ferroviaire) ? " m" : "")}${item("Distance au fluvial", p.desserte_distance_fluvial, present(p.desserte_distance_fluvial) ? " m" : "")}${item("Distance à une ITE en bon état", present(p.distance_ite_bon) ? fmt(p.distance_ite_bon) : null, " km")}</div>`)}
        ${section("06 · PROJET ET HISTORIQUE", "Ce qui est documenté", `<div class="kpi-grid kpi-grid-six">${item("Activité antérieure", p.activite_libelle)}${item("Fin d’activité", p.activite_fin_annee)}${item("Année de mutation", p.date_mutation)}${item("Projet de reconversion", p.site_reconv_type)}${item("Année de reconversion", p.site_reconv_annee)}${item("Propriétaire — catégorie", p.proprio_personne)}</div>${listBlock("Propriétaires publics mentionnés dans la source", p.proprio_nom, "owners")}${listBlock("Références cadastrales", p.unite_fonciere_refcad, "cadastre")}${sourceLink(p.site_projet_url, "Consulter la page du projet")}`)}
        ${section("07 · SOURCE ET PRUDENCE", "Traçabilité de la fiche", `<div class="kpi-grid kpi-grid-six">${item("Source", p.source_nom)}${item("Producteur", p.source_producteur)}${item("Date d’identification", p.site_identif_date)}${item("Dernière actualisation du site", p.site_actu_date)}${item("Création de l’enregistrement", p.date_creation)}${item("Nature de la source", p.nature)}</div>${sourceLink(p.source_url, "Consulter la source d’origine")}${sourceLink(p.site_url, "Consulter la fiche externe")}${sourceLink(p.site_ademe_url, "Consulter la référence ADEME")}<div class="method-note"><strong>Important :</strong> cette fiche compile les informations publiques présentes dans Cartofriches à la date d’extraction. Elle ne vaut ni diagnostic foncier, ni étude de pollution, ni certificat d’urbanisme, ni décision de constructibilité. Une donnée non renseignée doit être vérifiée auprès du producteur ou de la collectivité compétente.</div>`)}
      </div></div>`;
  }
  fetch("data/processed/friches95.json").then((response) => response.json()).then((data) => {
    const feature = (data.features || []).find((entry) => String(entry.id) === id);
    if (!feature) throw new Error("Friche introuvable");
    render(feature);
  }).catch(() => { root.innerHTML = '<div class="loading">Friche introuvable. Revenez à la carte et choisissez une fiche dans le sélecteur.</div>'; });

  document.getElementById("openExport").onclick = () => dialog.showModal();
  document.getElementById("closeExport").onclick = () => dialog.close();
  dialog.onclick = (event) => { if (event.target === dialog) dialog.close(); };
  document.getElementById("printProfile").onclick = () => { dialog.close(); window.print(); };
  document.getElementById("makePdf").onclick = async () => {
    dialog.close(); document.body.classList.add("exporting");
    const filename = currentName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    try { await html2pdf().set({ margin: 0, filename: `fiche-friche-${filename}.pdf`, image: { type: "jpeg", quality: 0.96 }, html2canvas: { scale: 2, useCORS: true, letterRendering: true }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"], avoid: [".section", ".kpi"] } }).from(document.getElementById("report")).save(); }
    finally { document.body.classList.remove("exporting"); }
  };
})();
