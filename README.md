# Print Map Studio

A free, browser-based map design studio for creating print-ready maps with routes, places, areas, local project persistence, and PNG/PDF/SVG export. The public site is statically rendered with Astro; the React and MapLibre editor is isolated at `/editor/`.

## Live site

- Marketing site: [https://printmaps.yasoob.me/](https://printmaps.yasoob.me/)
- Map editor: [https://printmaps.yasoob.me/editor/](https://printmaps.yasoob.me/editor/)

## Public routes

| Route | Purpose |
|---|---|
| `/` | Product landing page |
| `/features/` | Detailed editor and export capabilities |
| `/use-cases/` | Publishing, tourism, property, event, and personal workflows |
| `/#faq` | Product, storage, provider, and export answers |
| `/editor/` | Client-side React map editor |

## Local development

```bash
npm ci
npm run dev
```

Astro renders marketing pages as static HTML and loads no editor JavaScript on those routes. The editor entry loads React, MapLibre, and its styles only at `/editor/`.

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

## Export quality

PNG and PDF basemaps render from bounded native MapLibre regions at a 300 DPI target rather than enlarging the browser preview. PNG includes physical-resolution metadata, while PDF uses lossless raster basemap streams and keeps routes, places, and areas as named vector layers.

## GitHub Pages

Pushes to `main` deploy the Astro static output automatically through `.github/workflows/deploy-pages.yml`. Add the browser-safe Mapbox token as the Actions secret `VITE_MAPBOX_PUBLIC_ACCESS` to enable provider-backed features on the deployed editor.
