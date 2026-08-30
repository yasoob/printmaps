# Print Map Studio

A free, local-first map design studio for creating static, print-ready maps in the browser. Design the base map, add routes, places and areas, import geographic data, then export PNG, PDF or layered SVG without creating an account.

## Live site

- Marketing site: [https://printmaps.yasoob.me/](https://printmaps.yasoob.me/)
- Map editor: [https://printmaps.yasoob.me/editor/](https://printmaps.yasoob.me/editor/)

## Product capabilities

- Standard and custom print dimensions in millimetres, with landscape and portrait orientation.
- Multiple map styles, label languages, text scaling and map-detail visibility.
- Editable routes, places, custom markers, shapes, administrative boundaries and travel-time areas.
- GPX, KML and GeoJSON import, plus spreadsheet-based place creation.
- Browser-local autosave and portable project downloads.
- Print-sized PNG, exact-page PDF and layered SVG export.

Provider-backed place search, road routing, map matching, address lookup and isochrones require a browser-safe Mapbox public token. Core editing and OpenFreeMap rendering remain available without one.

## Architecture and routes

Astro statically renders the marketing site, while the React 19 and MapLibre editor is isolated as a client application at `/editor/`. Marketing pages do not download the editor bundle. The homepage uses Tailwind CSS and a small progressive-enhancement script for its accessible feature tour.

| Route | Purpose |
|---|---|
| `/` | Homepage with product hero, capabilities, interactive feature tour, use cases and FAQ |
| `/#features` | Interactive design, content and export tour |
| `/#use-cases` | Publishing, tourism, property, event, personal and planning workflows |
| `/#faq` | Product, storage, provider and export answers |
| `/features/` | Detailed editor and export capabilities |
| `/use-cases/` | Detailed audience and workflow guidance |
| `/editor/` | Client-side map editor |

## Local development

```bash
npm ci
npm run dev
```

Astro serves the site at `http://127.0.0.1:4321/`; open `/editor/` for the application.

To enable provider-backed tools, add a browser-safe token to `.env.local`:

```bash
VITE_MAPBOX_PUBLIC_ACCESS=pk.example
```

Never use or commit a secret Mapbox token.

## Verification

```bash
npm run typecheck
npm run lint
npm run doctor
npm test -- --run
npm run build
npm run test:e2e:marketing
npm run test:e2e:release
```

Chromium is the acceptance browser. `test:e2e:release` runs the editor suite in three serialized shards and then the Astro marketing suite. `npm run test:e2e` is the Linux/Xvfb release wrapper.

## Export model

PNG and PDF basemaps render from bounded native MapLibre regions at a 300 DPI target rather than enlarging the browser preview. PNG includes physical-resolution metadata. PDF preserves the exact page and named vector overlays. Layered SVG keeps supported routes, places and shapes as named vector groups, while the basemap may remain raster.

## Deployment

Pushes to `main` build and deploy the Astro `dist/` directory through `.github/workflows/deploy-pages.yml`. Configure `VITE_MAPBOX_PUBLIC_ACCESS` as an Actions secret to enable provider-backed tools in the deployed editor.
