#!/usr/bin/env python3
"""Construit les profils Sol · formes urbaines à partir de sources publiques."""
from __future__ import annotations

import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "processed"
API = "https://apidf-preprod.cerema.fr"


def get_json(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": "DDT95-atlas/1.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.load(response)
        except Exception:
            if attempt == 3:
                raise
            time.sleep(0.6 * (attempt + 1))


def metric(value, unit, year, source, denominator=None, quality="ok"):
    return {"value": value, "unit": unit, "year": year, "source": source,
            "denominator": denominator, "quality_flag": quality}


def summarize(rows, logement, friches):
    rows = sorted(rows, key=lambda row: row["annee"])
    ref = [row for row in rows if 2011 <= row["annee"] <= 2020]
    recent = [row for row in rows if 2021 <= row["annee"] <= 2030]
    ref_total = sum(row.get("naf_arti") or 0 for row in ref)
    recent_total = sum(row.get("naf_arti") or 0 for row in recent)
    target = ref_total / 2
    progress = (recent_total / target * 100) if target else None
    usages = {key: sum(row.get(key) or 0 for row in rows) for key in
              ("conso_hab", "conso_act", "conso_mix", "conso_infra", "conso_inc")}
    rp = logement.get("parc", {}).get("residences_principales", {}).get("value")
    apartments = logement.get("parc", {}).get("appartements", {}).get("value")
    apartment_share = apartments / rp * 100 if apartments is not None and rp else None
    site_area = sum((site.get("site_surface") or 0) for site in friches)
    return {
        "consommation": {
            "reference_2011_2020": metric(ref_total / 10000, "ha", "2011-2020", "cerema_conso"),
            "depuis_2021": metric(recent_total / 10000, "ha", "2021-2024", "cerema_conso"),
            "objectif_2021_2030": metric(target / 10000, "ha", "2021-2030", "loi_climat_cerema"),
            "avancement_objectif": metric(progress, "%", "2021-2024", "calcul_ddt95", target / 10000 if target else None),
            "serie_annuelle": [{"annee": row["annee"], "hectares": (row.get("naf_arti") or 0) / 10000} for row in rows],
            "usages": {key: value / 10000 for key, value in usages.items()},
        },
        "formes": {
            "logements": metric(logement.get("parc", {}).get("total", {}).get("value"), "logements", 2023, "insee_logement_2023"),
            "part_appartements": metric(apartment_share, "%", 2023, "insee_logement_2023", rp),
            "part_maisons": metric(100 - apartment_share if apartment_share is not None else None, "%", 2023, "insee_logement_2023", rp),
        },
        "friches": {
            "nombre": metric(len(friches), "sites", 2026, "cartofriches"),
            "surface": metric(site_area / 10000, "ha", 2026, "cartofriches"),
            "sites": friches,
        },
    }


def main():
    communes = json.loads((DATA / "communes95.json").read_text())
    logement_communes = json.loads((DATA / "commune_profiles.json").read_text())
    logement_epcis = json.loads((DATA / "epci_profiles.json").read_text())
    friche_data = get_json(f"{API}/cartofriches/geofriches/?coddep=95&page_size=300&fields=all")
    by_commune = {}
    public_friches = []
    for feature in friche_data.get("features", []):
        p = feature.get("properties", {})
        code = str(p.get("comm_insee") or p.get("code_insee") or "")
        site = {key: p.get(key) for key in ("site_nom", "comm_nom", "site_surface", "site_type", "site_statut", "urba_zone_type", "urba_zone_lib", "sol_pollution_existe", "source_nom", "source_url")}
        site["geometry"] = feature.get("geometry")
        public_friches.append(site)
        if code:
            by_commune.setdefault(code, []).append(site)

    profiles = {}
    for index, commune in enumerate(communes, 1):
        code = commune["code"]
        rows = get_json(f"{API}/indicateurs/conso_espace/communes/{code}/?ordering=annee").get("results", [])
        profile = {"code": code, "name": commune["name"], "kind": "commune"}
        profile.update(summarize(rows, logement_communes.get(code, {}), by_commune.get(code, [])))
        profiles[code] = profile
        print(f"[{index:03}/{len(communes)}] {commune['name']}")

    epci_profiles = {}
    for code, base in logement_epcis.items():
        members = [member for member in base.get("members_covered", []) if member in profiles]
        rows_by_year = {}
        for member in members:
            for row in profiles[member]["consommation"]["serie_annuelle"]:
                rows_by_year[row["annee"]] = rows_by_year.get(row["annee"], 0) + row["hectares"] * 10000
        rows = [{"annee": year, "naf_arti": value} for year, value in sorted(rows_by_year.items())]
        sites = [site for member in members for site in profiles[member]["friches"]["sites"]]
        profile = {"code": code, "name": base["name"], "kind": "epci", "members": base.get("members", []),
                   "members_covered": members, "perimetre_partiel": base.get("perimetre_partiel", False),
                   "special": base.get("special", False)}
        profile.update(summarize(rows, base, sites))
        for usage in profile["consommation"]["usages"]:
            profile["consommation"]["usages"][usage] = sum(profiles[member]["consommation"]["usages"][usage] for member in members)
        epci_profiles[code] = profile

    rows_by_year = {}
    for profile in profiles.values():
        for row in profile["consommation"]["serie_annuelle"]:
            rows_by_year[row["annee"]] = rows_by_year.get(row["annee"], 0) + row["hectares"] * 10000
    department_rows = [{"annee": year, "naf_arti": value} for year, value in sorted(rows_by_year.items())]
    department_sites = [site for profile in profiles.values() for site in profile["friches"]["sites"]]
    department_base = {"parc": {"total": {"value": sum((p["formes"]["logements"]["value"] or 0) for p in profiles.values())}}}
    department = {"code": "95", "name": "Val-d’Oise", "kind": "departement"}
    department.update(summarize(department_rows, department_base, department_sites))
    for usage in department["consommation"]["usages"]:
        department["consommation"]["usages"][usage] = sum(profile["consommation"]["usages"][usage] for profile in profiles.values())

    (DATA / "sol_commune_profiles.json").write_text(json.dumps(profiles, ensure_ascii=False, indent=2))
    (DATA / "sol_epci_profiles.json").write_text(json.dumps(epci_profiles, ensure_ascii=False, indent=2))
    (DATA / "sol_departement_profile.json").write_text(json.dumps(department, ensure_ascii=False, indent=2))
    (DATA / "friches95.json").write_text(json.dumps({"type": "FeatureCollection", "features": friche_data.get("features", [])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
