# Carnet de Vol

Site d'actualité aéronautique vérifiée et base historique des accidents d'avion. Chaque fiche contient un récit, des images et des sources ; les brèves d'actualité sont produites automatiquement (voir `docs/newsbot.md`).

## Utilisation

- Ouvrez `index.html` dans un navigateur. Tout fonctionne en local (pas besoin de serveur).
- Navigation via le hash: `#/` (liste), `#/accident/<id>`, `#/a-propos`.

## Ajouter un accident

1. Éditez `data/accidents.json` et ajoutez un objet en respectant le schéma ci-dessous.
2. Placez les images associées dans `assets/img/`. Référez-les via un chemin relatif (ex: `assets/img/af447-1.jpg`).
3. Facultatif: ajoutez des liens vers les rapports d'enquête (BEA/NTSB/CIAIAC/etc.) dans `sources`.

### Schéma JSON (simplifié)

```json
{
  "id": "string-unique",
  "title": "Titre de l'événement",
  "date": "YYYY-MM-DD",
  "location": "Lieu (ville, pays)",
  "aircraft": "Type d'appareil (immatriculation)",
  "airline": "Compagnie",
  "fatalities": 0,
  "images": [
    { "url": "assets/img/file.jpg", "caption": "Légende (optionnel)" }
  ],
  "sources": [
    { "title": "Nom de la source", "url": "https://exemple" }
  ],
  "description": "HTML – récit synthétique"
}
```

Voir aussi `docs/schema.md` pour les détails et bonnes pratiques.

## Bonnes pratiques éditoriales

- Neutralité, exactitude et clarté. Cite toujours tes sources.
- Utilise les rapports d'enquête officiels quand ils existent.
- Privilégie un récit pédagogique et factuel; évite le sensationnalisme.
- Mentionne les améliorations/procédures issues de l'accident lorsqu'elles sont connues.

## Actualités automatiques

La page `/actualites/` est alimentée par un robot (`bot/newsbot.py`) lancé par GitHub Actions toutes les 10 minutes. Fonctionnement, réglages, coûts et limites : voir `docs/newsbot.md`.

## Images

Les photos proviennent de Wikimedia Commons, sous licence libre ; l'auteur et la licence sont enregistrés dans `data/accidents.json` (champ `credit`) et affichés sous chaque image. Pour en ajouter : workflow « Images libres » (`scripts/images_libres.py`), puis `python3 scripts/sync_static_images.py` pour mettre à jour les pages statiques.

## Personnalisation

- Couleurs/styles: `assets/css/styles.css`.
- Comportement/affichage: `assets/js/app.js`.

## Déploiement

- Héberge le dossier tel quel sur n'importe quel service de pages statiques (GitHub Pages, Netlify, etc.).

