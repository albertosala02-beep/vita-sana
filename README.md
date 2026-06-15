# 🌿 Vita Sana

Diario alimentare e fitness PWA — pensato per gestire insulino-resistenza / PCOS.

Logga pasti, esercizi, acqua e peso. Semaforo live su ogni pasto. Streak, achievement, trend peso.

## Setup locale

```bash
npm install
npm run dev
```

Apri `http://localhost:5173/vita-sana/`

## Deploy su GitHub Pages

### Opzione A — gh-pages (consigliata)

```bash
npm run deploy
```

Poi vai su **Settings → Pages → Source** del repo e seleziona il branch `gh-pages`.

Il sito sarà su: `https://<tuo-username>.github.io/vita-sana/`

### Opzione B — GitHub Actions

Crea `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - uses: actions/deploy-pages@v4
```

Poi in **Settings → Pages → Source** seleziona "GitHub Actions".

## Note

- I dati sono salvati in `localStorage` del browser — se cambi browser o dispositivo, riparti da zero
- L'app è installabile come PWA su telefono (Aggiungi a schermata Home)
- Se il nome del repo è diverso da `vita-sana`, aggiorna `base` in `vite.config.js`

## Stack

React 18 · Tailwind 3 · Vite 6 · PWA vanilla
