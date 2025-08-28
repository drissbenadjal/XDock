Publication & auto-update (GitHub Releases)

Ce projet est configuré pour publier les artefacts via GitHub Releases et utiliser electron-updater pour les mises à jour automatiques.

Pré-requis :

- Avoir un token GitHub avec `repo` scope (ou `public_repo` pour les dépôts publics).
- Définir la variable d'environnement GITHUB_TOKEN sur la machine CI ou votre poste avant de lancer `electron-builder`.

Exemple (PowerShell) :

```powershell
$env:GITHUB_TOKEN = 'ghp_xxx...'
npm run build
# ou pour build+pack
npm run build && electron-builder --win
```

Notes :

- Le champ `publish` dans `electron-builder.yml` est configuré pour `owner: drissbenadjal` et `repo: XDock`.
- Sur Windows, l'artefact `nsis` sera généré et uploadé.
- electron-updater s'appuie sur les releases GitHub pour détecter et télécharger les mises à jour.
- En développement local (npm run dev) les checks d'updates sont ignorés.

Étapes recommandées pour publier :

1. Bump version in `package.json` (semver).
2. Commit & tag (git tag -a vX.Y.Z -m "release vX.Y.Z" && git push --tags).
3. Run `npm run build` then `electron-builder --publish always` (ou configurez CI pour publier automatiquement).

Exemple simple pour publish depuis la machine locale :

```powershell
# set token
$env:GITHUB_TOKEN = 'ghp_xxx'
# build and publish
npm run build
electron-builder --publish always
```

Si vous voulez que je place un script npm pour builder+publish, je peux l'ajouter au `package.json`.
