# Schéma et directives éditoriales

## Objectif

Fournir une structure cohérente pour chaque fiche d'accident, avec des champs bien définis pour faciliter la recherche, le filtrage et la lecture.

## Schéma JSON détaillé

- id: identifiant chaîne unique, stable et lisible. Ex: `af447-2009` ou `klm-pan-am-tfn-1977`.
- title: titre concis et informatif.
- date: ISO `YYYY-MM-DD` (si jour inconnu, utiliser `YYYY-MM-01` et préciser dans le récit).
- location: ville, région/pays.
- aircraft: type et, si possible, immatriculation au format `Type (Immat)`.
- airline: compagnie opératrice (ou affrètement si pertinent), ou multiple "KLM / Pan Am".
- fatalities: entier du nombre de décès (incluant sol si connu) ou omettre si non établi.
- passengersTotal: entier du nombre total de passagers (ou personnes à bord si vous ne distinguez pas équipage). Sert à calculer les survivants.
- images: liste d'objets `{ url, caption? }`. Stockage local recommandé.
- sources: liste d'objets `{ title?, url }`. Utiliser les rapports officiels (BEA/NTSB/AAIB/CIAIAC/TSB, etc.) quand ils existent.
- description: HTML autorisé (paragraphe, listes, `<abbr>`, `<strong>`, etc.). Rester concis et sourcer.

## Qualité des données

- Cohérence des dates et des nombres (utiliser des sources primaires si possible).
- Orthographe et accents en français.
- Mention des éléments contributifs (facteurs humains, techniques, environnementaux) sans spéculation.

## Accessibilité et style

- Fournir des `alt`/`caption` significatifs pour les images.
- Utiliser des titres hiérarchiques (`h1` dans détail, `h3` dans cartes).
- Éviter les murs de texte: paragraphes courts, listes quand pertinent.
