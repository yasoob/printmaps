# Print Map Studio

A client-side map editor for creating print-ready maps with routes, places, areas, local project persistence, and PNG/PDF/SVG export.

## Live site

[https://printmaps.yasoob.me/](https://printmaps.yasoob.me/)

## Local development

```bash
npm ci
npm run dev
```

Provider-backed search, road routing, map matching, and travel-time areas use a browser-safe Mapbox public token supplied as `VITE_MAPBOX_PUBLIC_ACCESS`. Core editing and OpenFreeMap rendering remain available without it.

## Verification

```bash
npm run typecheck
npm run lint
npm run doctor
npm test -- --run
npm run build
```

Chromium is the acceptance browser for the end-to-end suite.

## GitHub Pages

Pushes to `main` deploy automatically through `.github/workflows/deploy-pages.yml`. Add the browser-safe Mapbox token as the Actions secret `VITE_MAPBOX_PUBLIC_ACCESS` to enable provider-backed features on the deployed site.
