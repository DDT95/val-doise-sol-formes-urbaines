# Sol · formes urbaines

Carte interactive du Val-d’Oise pour comprendre la consommation d’espace, les formes urbaines, les friches et la trajectoire ZAN à l’échelle de la commune ou de l’EPCI.

Le site reprend strictement le modèle fonctionnel et graphique des pages [Domicile ↔ Travail](https://github.com/DDT95/val-doise-domicile-travail) et [Logement · Habitat](https://github.com/DDT95/val-doise-logement-habitat) : carte, panneau territorial à droite, mode Commune/EPCI, responsive et fiches PDF.

## Ce que la page permet de comprendre

- distinguer consommation d’espace et artificialisation ;
- comparer la décennie de référence 2011-2020 avec la période engagée depuis 2021 ;
- lire un repère pédagogique de trajectoire ZAN sans le confondre avec un quota réglementaire ;
- relier les transformations aux usages et aux formes résidentielles ;
- identifier les friches recensées comme potentiels à qualifier avant toute extension.

## Sources

- Cerema / DGALN, consommation d’espaces naturels, agricoles et forestiers issue des Fichiers fonciers, 2011-2024 ;
- Cerema, Cartofriches, inventaire évolutif ;
- Insee, Recensement de la population 2023 — Logement ;
- IGN, OCS GE et nomenclature nationale de l’artificialisation.

Le repère 2021-2030 affiché correspond à 50 % de la consommation 2011-2020. Il est pédagogique et ne remplace pas la territorialisation juridique des documents de planification.

## Développement local

```bash
python3 -m http.server 8420
```

Puis ouvrir `http://localhost:8420`.

Pour reconstruire les profils :

```bash
python3 scripts/build_profiles.py
```
