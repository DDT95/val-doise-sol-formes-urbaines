#!/usr/bin/env python3
"""Injecte les couches DPU / permis de louer / permis de diviser / SDRIF
dans les profils communaux déjà construits par build_profiles.py.

Contrairement à build_profiles.py, ce script ne fait aucun appel réseau :
il relit les tables éditables à la main dans data/raw/ et les fusionne
dans data/processed/sol_commune_profiles.json et sol_departement_profile.json.
À relancer à chaque mise à jour de data/raw/foncier_reglementaire_95.json
ou data/raw/sdrif_capacite_95.json.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def reglementation_for(code: str, foncier: dict) -> dict:
    row = foncier.get(code, {})

    def field(key):
        entry = row.get(key)
        if not entry:
            return {"value": None, "zone": None, "deliberation": None, "source": None, "quality_flag": "non_renseigne"}
        return {
            "value": entry.get("statut"),
            "zone": entry.get("zone"),
            "deliberation": entry.get("deliberation"),
            "source": entry.get("source"),
            "quality_flag": "ok",
        }

    return {
        "dpu": field("dpu"),
        "permis_louer": field("permis_louer"),
        "permis_diviser": field("permis_diviser"),
    }


def sdrif_for(code: str, sdrif: dict) -> dict:
    row = sdrif.get(code, {})
    return {
        "situation": {
            "value": row.get("situation_sdrif"),
            "quality_flag": "ok" if row.get("situation_sdrif") else "non_disponible",
        },
        "capacite_residuelle": {
            "value": row.get("capacite_residuelle_ha"),
            "unit": "ha",
            "quality_flag": "ok" if row.get("capacite_residuelle_ha") is not None else "non_disponible",
        },
        "commentaire": row.get("commentaire"),
    }


def apply(profiles: dict, foncier: dict, sdrif: dict, code_key="code"):
    for code, profile in profiles.items():
        ref_code = profile.get(code_key, code)
        profile["reglementation"] = reglementation_for(ref_code, foncier)
        profile["sdrif"] = sdrif_for(ref_code, sdrif)


def main():
    foncier = {k: v for k, v in load(RAW / "foncier_reglementaire_95.json").items() if not k.startswith("_")}
    sdrif = {k: v for k, v in load(RAW / "sdrif_capacite_95.json").items() if not k.startswith("_")}

    commune_path = PROCESSED / "sol_commune_profiles.json"
    communes = load(commune_path)
    apply(communes, foncier, sdrif)
    commune_path.write_text(json.dumps(communes, ensure_ascii=False, indent=2), encoding="utf-8")

    dept_path = PROCESSED / "sol_departement_profile.json"
    dept = load(dept_path)
    dept["reglementation"] = {
        "note": "Synthèse non pertinente à l'échelle départementale : DPU, permis de louer et permis de diviser sont des décisions communales ou intercommunales. Voir la fiche de chaque commune.",
    }
    dept["sdrif"] = sdrif_for(dept.get("code", ""), sdrif)
    dept_path.write_text(json.dumps(dept, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Communes mises à jour : {len(communes)}")


if __name__ == "__main__":
    main()
