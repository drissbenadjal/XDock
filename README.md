# Wallpaper Engine (prototype)

Fonctionnalité ajoutée au projet Electron minimal : possibilité de choisir une vidéo locale et de créer une fenêtre "wallpaper" qui lit la vidéo en boucle.

Ce que j'ai implémenté

- IPC dans le main process : `open-video-dialog` et `create-wallpaper-window`.
- Préload expose : `window.api.openVideoDialog()` et `window.api.createWallpaperWindow()`.
- UI : dans `src/renderer/src/App.jsx` boutons pour choisir une vidéo, prévisualiser et définir comme fond d'écran.
- Mode "wallpaper" : si la fenêtre est lancée avec `?wallpaper=1&video=...` elle affichera uniquement la vidéo en plein écran.

Comment tester en développement (Windows PowerShell)

1. Installer les dépendances (déjà fait si vous avez exécuté `npm install`):

```powershell
npm install
```

2. Vérifier la version de Node (Vite requiert Node >= 20.19.0)

```powershell
node --version
```

Si votre version est inférieure à 20.19.0, installez/activez une version compatible (par exemple avec nvm-windows):

```powershell
# après installation de nvm-windows
nvm install 20.19.0
nvm use 20.19.0
```

3. Démarrer en dev:

```powershell
npm run dev
```

4. Dans la fenêtre principale, cliquez sur "Choisir une vidéo", sélectionnez un fichier vidéo local et cliquez sur "Définir comme fond d'écran".

Limitation importante (Windows)

- La technique actuelle crée une fenêtre Electron plein écran et la rend non-focusable et ignorante des clics. Cela la place au-dessus du bureau par défaut.
- Pour placer réellement la vidéo derrière les icônes du bureau (sous les icônes), il faut utiliser une intégration native Windows : attacher la fenêtre au handle de la fenêtre du bureau (Progman/WorkerW) via l'API Win32 (SetParent, etc.). Ce code natif n'est pas inclus ici. Si vous voulez, je peux implémenter un module pour Windows qui place correctement la fenêtre derrière les icônes.

Prochaines améliorations possibles

- Implémenter la parenté de fenêtre sous Windows pour l'afficher sous les icônes.
- Gérer plusieurs écrans et mémoriser la vidéo sélectionnée par écran.
- Ajouter des options : mute/unmute, contrôle du volume, position/cropping, lecture intelligente (redimensionnement) et playlist.

Si vous voulez que j'implémente la mise sous les icônes sous Windows, dites-moi et je m'en occupe — j'aurai besoin d'autorisation pour ajouter un module natif ou une dépendance (ex: node-ffi, edge-js, ou un binaire précompilé).

---

Fichier modifiés principaux :

- `src/main/index.js` — handlers IPC + création fenêtre wallpaper
- `src/preload/index.js` — exposer API
- `src/renderer/src/App.jsx` — UI pour choisir et définir la vidéo + mode wallpaper

Vérifiez `npm run dev` et dites-moi si vous voulez que j'implémente l'intégration native Windows.

# wallpaper

An Electron application with React

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
