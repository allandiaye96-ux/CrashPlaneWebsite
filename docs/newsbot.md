# Robot d'actualités

Le robot publie des brèves d'actualité aéronautique sur la page `/actualites/`.
Il tourne tout seul sur GitHub (GitHub Actions), sans serveur. Un service gratuit externe (cron-job.org) le déclenche toutes les 10 minutes ; une exécution planifiée par GitHub toutes les 30 minutes sert de filet de sécurité, car GitHub retarde ou saute souvent les tâches planifiées fréquentes.

## Fonctionnement

1. **Lecture des flux.** La liste des flux RSS se trouve dans `bot/config.json` (presse spécialisée, EASA, AAIB britannique…). Un flux en panne est ignoré sans bloquer les autres.
2. **Tri et regroupement.** Un modèle d'IA léger (Claude Haiku) écarte les articles hors sujet ou promotionnels. Il regroupe ensuite les articles qui parlent du même événement en « dossiers ».
3. **Corroboration.** Un dossier n'est rédigé que s'il remplit l'une de ces conditions :
   - il est rapporté par au moins **2 éditeurs indépendants** (deux domaines différents), statut affiché « Corroboré par plusieurs sources » ;
   - il provient d'**une source officielle** (NTSB, FAA, EASA, BEA…), statut affiché « Confirmé par une source officielle ».

   - **exception pour l'actualité industrielle** (catégories « Compagnies », « Constructeurs et industrie », « Aéroports », réglables via `single_source_categories`) : une seule source spécialisée suffit (aucun badge n'est affiché ; le nombre de sources apparaît en bas de la brève). La brève attribue alors chaque information à cet éditeur. Les accidents, incidents, enquêtes, sujets de sécurité et de défense restent soumis à la règle des 2 sources.

   Un dossier qui reste à une seule source pendant 48 h (hors exception) est abandonné. Des dossiers manifestement identiques, que le tri aurait séparés, sont fusionnés automatiquement.
4. **Rédaction.** L'IA rédige une brève en français, en s'appuyant uniquement sur les titres et extraits des sources. Elle signale les contradictions entre sources et n'avance aucune cause d'accident.
5. **Contrôle des chiffres.** Chaque nombre de la brève doit figurer dans au moins une source. Sinon, la brève est réécrite une fois, puis mise de côté si l'erreur persiste.
6. **Mises à jour.** Quand de nouvelles sources arrivent sur un événement déjà publié, la brève est réécrite. Elle affiche alors « mis à jour le … ».

## Mode brouillon / publication

- `"publish": false` dans `bot/config.json` (réglage par défaut) : les brèves sont rédigées mais **pas affichées** sur `/actualites/`. Elles sont visibles sur `/actualites/brouillons/`, une page non référencée par les moteurs de recherche.
- `"publish": true` : les **nouvelles** brèves s'affichent directement sur `/actualites/`. Un ancien brouillon n'est publié que s'il reçoit une mise à jour (nouvelle source).

## Déclencheur externe (cron-job.org)

- Requête : `POST https://api.github.com/repos/allandiaye96-ux/CrashPlaneWebsite/actions/workflows/newsbot.yml/dispatches`
- En-têtes : `Authorization: Bearer <jeton>`, `Accept: application/vnd.github+json`, `Content-Type: application/json`
- Corps : `{"ref":"main"}`
- Jeton : jeton GitHub « fine-grained » limité à ce dépôt, permission **Actions : Read and write** uniquement, avec une date d'expiration. À renouveler à l'expiration (cron-job.org signalera alors des erreurs 401).

## Retirer une brève

1. Sur GitHub, ouvre `data/news/stories.json` et clique sur le crayon (Modifier).
2. Cherche la brève par son titre.
3. Remplace `"hidden": false` par `"hidden": true`, puis enregistre (Commit changes).

La brève disparaît du site en une à deux minutes, et le robot ne la réaffiche pas.

## Coûts et garde-fous

- Le modèle par défaut est `claude-haiku-5-5` (0,10 $ par million de jetons en entrée et 0,50 $ en sortie, tarif d'octobre 2026).
- Le plafond est fixé par `monthly_budget_usd` (5 $ par défaut). Une fois ce plafond atteint, le robot ne fait plus aucun appel jusqu'au mois suivant.
- La dépense estimée est suivie dans `data/news/state.json`, rubrique `spend`. Fixe aussi une limite de dépense dans la console Anthropic : c'est le garde-fou réel.
- Pour une meilleure qualité de rédaction, remplace `model_writer` par `claude-sonnet-5-5`. Ce modèle coûte environ 20 fois plus cher.

## Limites connues

- **Corroboration n'est pas vérité.** Deux médias peuvent reprendre la même dépêche erronée.
- **L'indépendance est approximée par le nom de domaine.** Un même groupe de presse peut posséder plusieurs sites.
- **Les brèves sont fondées sur les extraits RSS**, pas sur les articles complets. Elles sont donc courtes, et l'IA peut manquer une nuance.
- **Le contrôle des chiffres ne couvre pas les nombres écrits en lettres** (« trois morts »), ni les noms propres.
- **Les horaires dépendent de GitHub**, qui peut retarder ou sauter des exécutions planifiées. Si le dépôt reste 60 jours sans activité, GitHub désactive les tâches planifiées : il suffit alors de les réactiver dans l'onglet Actions.

## Commandes utiles

```bash
python3 -m pytest -q bot/tests          # tests hors ligne (flux et IA simulés)
ANTHROPIC_API_KEY=... python3 bot/newsbot.py   # lancement manuel en local
```
