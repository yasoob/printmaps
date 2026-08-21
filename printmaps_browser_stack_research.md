# Browser-only open-source stack for a Printmaps.net-like app

**Research date:** 2026-08-21 UTC. Maintenance signals below are latest npm publication and/or GitHub `pushed_at` observed on that date. “Browser-only” means the shipped app runs in a browser and can be hosted as static files; Mapbox HTTP APIs and tile/static-file origins remain network dependencies.

## Executive recommendation

Use **MapLibre GL JS 6 + MapLibre Style Spec** for the interactive map, with optional **PMTiles** for static-hosted vector tiles; **Terra Draw + Turf** for editing and geospatial operations; **toGeoJSON** for GPX/KML import; native JSON plus small audited serializers for GeoJSON/GPX/KML export; and an **independent SVG print scene** built with **SVG.js**. Render the print scene to SVG directly, to PDF with **jsPDF + svg2pdf.js**, to PNG with **resvg-wasm**, and to layered RGB PSD with **ag-psd**. Use **OpenType.js** for repeatable metrics and **harfbuzzjs** only when complex-script shaping is needed. Persist projects in **Dexie/IndexedDB**, and move parsing, geometry, high-resolution rasterization, and PSD creation into **Web Workers via Comlink**. Test with **Vitest + Playwright + pixelmatch**.

MapLibre is an actively maintained BSD-3 browser renderer and its style language has a public specification.[1][2] PMTiles can expose a tile pyramid from one range-readable static file rather than a custom tile backend.[3]

### Important design decision

Do **not** treat the WebGL canvas as the print document. Maintain one canonical project model and two views:

1. **Interactive view:** MapLibre canvas + Terra Draw, DOM controls/markers.
2. **Print view:** physical page in millimetres/points; basemap capture(s) plus vector `<g>` groups for routes, labels, legends, scale, frames, and marks.

This preserves editable overlay layers in SVG/PDF/PSD. A MapLibre basemap is still raster once read from WebGL; there is no maintained, complete browser library that converts arbitrary MapLibre styles, glyph placement, symbols, terrain, and custom layers into layered SVG. A genuinely all-vector basemap would require a second, deliberately limited SVG renderer over source GeoJSON/vector tiles.

## Recommended stack

| Area | Candidate and exact URL | License | Maintenance signal | Browser compatibility | Role | Caveats |
|---|---|---:|---|---|---|---|
| Map renderer | [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js), [docs](https://maplibre.org/maplibre-gl-js/docs/) | BSD-3-Clause | npm `maplibre-gl` 6.4.1 published 2026-08-18; repo pushed 2026-08-20 | Modern browsers with WebGL2; v6 is ESM | Interactive vector/raster map, sources, layers, markers, projection, style expressions | WebGL output is raster for export. Default `maxCanvasSize` is 4096×4096; do not exceed GPU `MAX_TEXTURE_SIZE`. v6 requires WebGL2 and a one-time worker/bundler setup. |
| Style model/editor | [MapLibre Style Spec](https://maplibre.org/maplibre-style-spec/); [Maputnik](https://github.com/maplibre/maputnik) | Spec implementation BSD-3; Maputnik MIT | Style package ships with MapLibre 6.4.1; Maputnik pushed 2026-08-20 | Browser | Serializable style JSON and browser style authoring | Mapbox style extensions are not all portable; fonts, sprites, tiles, and data each have separate licensing/CORS concerns. |
| Static tile transport | [PMTiles JS](https://github.com/protomaps/PMTiles) | BSD-3-Clause (`pmtiles` npm) | npm 4.5.0 published 2026-08-10; repo pushed 2026-08-19 | Fetch/HTTP Range in modern browsers; MapLibre protocol adapter | Serve vector/raster tiles from static object storage/CDN with no application backend | The archive is not map data. OSM-derived tiles normally require attribution and may be ODbL; build or license a production tileset. File-origin/offline behavior and CORS/range support must be tested. |
| Mapbox service client | Direct `fetch`, optionally [mapbox-sdk-js](https://github.com/mapbox/mapbox-sdk-js) | SDK BSD-2-Clause; APIs/data proprietary under Mapbox terms | SDK repo pushed 2026-07-17; npm 0.16.2 published 2025-09-12 | SDK declares browser transport; direct REST works in normal CORS-capable browsers | Typed/light wrapper for Geocoding, Directions, Map Matching; direct REST for Search Box | Prefer direct REST for complete/current endpoints. Public browser tokens are visible: restrict token URLs/scopes. Never ship a secret token.[8] API use, storage, billing, and display constraints are not open-source licenses. |
| Drawing/editing | [Terra Draw](https://github.com/JamesLMilner/terra-draw), [site](https://terradraw.io/) + `terra-draw-maplibre-gl-adapter` | MIT | core 1.32.3 published 2026-08-08; adapter 1.4.1 published 2026-05-17; repo pushed 2026-08-20 | Browser; adapter peer range is MapLibre `>=4` | Draw/select/edit points, lines, polygons, circles; canonical GeoJSON output | The README’s support table lagged at v4/v5, while current package metadata accepts v6. Pin an integration test around MapLibre upgrades. |
| Geometry | [Turf](https://github.com/Turfjs/turf), [docs](https://turfjs.org/) | MIT | npm 7.4.0 published 2026-08-03; repo pushed 2026-08-18 | Browser ESM/UMD; worker-friendly | Length, bbox, simplify, buffer, line slicing, transforms, snapping helpers | Import individual modules to control bundle size. Turf nearest-point operations are not road-network map matching. Work in WGS84 carefully for print-scale measurements. |
| GPX/KML/TCX import | [toGeoJSON](https://github.com/placemark/togeojson) (`@tmcw/togeojson`) | BSD-2-Clause | npm 7.1.2/repo push 2025-05-31 | Browser UMD/ESM; uses `DOMParser` | Convert KML, GPX, TCX XML into GeoJSON | Sanitise untrusted XML/descriptions before rendering. Large files belong in a worker. Extension metadata and styling are not lossless round trips. |
| GeoJSON validation | [check-geojson](https://github.com/placemark/check-geojson) (`@placemarkio/check-geojson`) | MIT | npm 0.1.14/repo push 2025-02-18 | Browser-bundleable TS/JS | Validate user GeoJSON before storing/editing | Validation does not impose application-level limits; separately cap feature/coordinate counts and nesting. |
| Markers/icons | [MapLibre Marker API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/) + [Maki](https://github.com/mapbox/maki) | MapLibre BSD-3; Maki CC0-1.0 | Maki repo pushed 2026-06-24; npm 8.2.0 published 2025-02-27 | DOM/SVG in modern browsers | Interactive markers and public-domain cartographic symbols | DOM markers are not part of the WebGL canvas capture. Recreate every printable marker in the SVG print scene. Raster sprites lose editability. |
| SVG print scene | [SVG.js](https://github.com/svgdotjs/svg.js), [docs](https://svgjs.dev/docs/3.2/) | MIT | npm 3.2.8/repo push 2026-08-04 | Modern browser SVG DOM | Page groups/layers, paths, clipped map frame, labels, legends, crop/bleed marks; native layered SVG export | Avoid unsupported browser-only CSS and external resources. Embed or outline fonts/assets for portable output. Use stable group IDs/names as export layer names. |
| PDF | [jsPDF](https://github.com/parallax/jsPDF) + [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) | MIT + MIT | jsPDF 4.2.1 published 2026-03-17; svg2pdf.js 2.7.0 published 2026-01-03 and repo pushed 2026-08-20 | Browser ESM bundles | Convert SVG print scene into vector PDF; insert basemap raster; explicit page size in points/mm | Validate fonts, clipping, blend modes, filters, and very large pages. Not a proven PDF/X prepress pipeline; no guarantee of ICC output intents, overprint, spot colors, or calibrated CMYK. |
| PNG/SVG rasterization | [resvg-js / `@resvg/resvg-wasm`](https://github.com/thx/resvg-js) | MPL-2.0 | repo pushed 2026-06-30; wasm npm 2.6.2 published 2024-03-26 | Pure Wasm artifact for browsers; initialize `.wasm` explicitly | Deterministic high-quality SVG→PNG at requested pixel size | Wasm memory can explode at poster sizes; rasterize in tiles/strips in a worker. Fonts and linked images must be embedded/provided. MPL obligations apply to modifications of covered files. |
| Layered PSD | [ag-psd](https://github.com/Agamnentzar/ag-psd) | MIT | npm 31.0.2 published 2026-07-02; repo pushed 2026-07-02 | Browser bundle; worker path needs `OffscreenCanvas` + `bitmaprenderer` | Create one raster PSD layer per SVG group, preserving names/order/visibility | Feasible only as **8-bit RGB PSD**. No CMYK/LAB/indexed writing, no 16-bit, no PSB, incomplete text layers, and it does not rebuild composite/thumbnail automatically. Prefer raster layers over editable PSD text. Memory and PSD size limits need hard guards.[15] |
| Font metrics/outlines | [OpenType.js](https://github.com/opentypejs/opentype.js), [site](https://opentype.js.org/) | MIT | npm 2.0.0 published 2026-05-06; repo pushed 2026-08-08 | Browser/Node | Deterministic `getAdvanceWidth`, glyph bounds, SVG path outlines from embedded TTF/OTF/WOFF | Built-in shaping is limited; outline conversion increases file size and loses editable/searchable text. Check font embedding rights. |
| Complex text shaping | [harfbuzzjs](https://github.com/harfbuzz/harfbuzzjs), [docs](https://harfbuzz.github.io/harfbuzzjs/) | MIT | npm 1.6.0 published 2026-08-09; repo pushed 2026-08-12 | Browser Wasm | Shape Arabic/Indic/complex scripts, then emit positioned glyph paths | Extra Wasm/font plumbing. Use only when browser canvas/OpenType.js metrics do not provide reproducible shaping. |
| Persistence | [Dexie](https://github.com/dexie/Dexie.js), [docs](https://dexie.org/) over [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) | Apache-2.0 | npm 4.4.5 published 2026-08-14; repo pushed 2026-08-17 | Browsers with IndexedDB | Versioned project DB, blobs/assets, autosave, migrations, recovery | Storage is origin-scoped, quota/eviction varies, and private browsing is not durable. Add explicit project ZIP/JSON backup/export; do not persist temporary Mapbox search/geocoding results when terms forbid it. |
| Workers | [Comlink](https://github.com/GoogleChromeLabs/comlink) over [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) | Apache-2.0 | repo pushed 2026-08-11; npm 4.4.2 published 2024-11-07 | Chrome 56+, Edge 15+, Firefox 52+, Safari 10.1+ per project; actual Wasm dependencies may require newer | RPC wrapper for parsing, Turf, resvg, and PSD workers | Transfer `ArrayBuffer`/`ImageBitmap`, do not clone giant pixel buffers. Worker-safe APIs differ from window APIs. Keep MapLibre’s own workers separate. |
| Tests | [Vitest](https://github.com/vitest-dev/vitest) + [Playwright](https://github.com/microsoft/playwright) + [pixelmatch](https://github.com/mapbox/pixelmatch) | MIT + Apache-2.0 + ISC | Vitest 4.1.11 (2026-08-18); Playwright 1.62.1 (2026-07-30); pixelmatch 7.2.0 (2026-04-29) | Test runner is dev-time Node; Playwright drives Chromium, Firefox, WebKit | Unit/property tests, browser E2E, download verification, visual regression | WebGL screenshots vary by GPU/driver. Use tolerances, fixed DPR/fonts/styles/tile fixtures, and separately inspect SVG/XML/PDF/PSD structure instead of pixel-only tests. |

## Mapbox API plan and constraints

Use URL-restricted, least-scope **public** tokens and direct REST calls. Debounce autocomplete; abort stale requests; wrap API calls behind interfaces so providers can change.

| Need | Official endpoint/docs | Browser use | Key limits/caveats observed |
|---|---|---|---|
| Address/place geocoding | [Geocoding API v6](https://docs.mapbox.com/api/search/geocoding/) | `fetch` GET/POST | `permanent=false` is default; temporary results may not be cached. Permanent storage requires `permanent=true` and account prerequisites. Default 1,000 requests/min. Official docs say responses may only be used with a Mapbox map.[4] |
| Autocomplete/POI search | [Search Box API](https://docs.mapbox.com/api/search/search-box/) | `fetch` `/suggest` then `/retrieve` | Distinct UUIDv4 `session_token` per concurrent session. Results are temporary-only under documented terms; default 10 requests/sec. A retrieve should complete the billing session.[5] |
| Route and alternatives | [Directions API v5](https://docs.mapbox.com/api/navigation/directions/) | `fetch`; request GeoJSON geometry | Driving/traffic/walking/cycling accept up to 25 coordinates; `alternatives=true` can return up to two and none may exist. Documented max 300 requests/min and profile-specific total-distance limits.[6] |
| GPS trace cleanup | [Map Matching API v5](https://docs.mapbox.com/api/navigation/map-matching/) | `fetch`; chunk long tracks with overlap, then reconcile | Max 100 coordinates/request (50 OpenLR), 300 requests/min. Official docs require results to be displayed on a Mapbox map using Mapbox libraries/SDKs.[7] |
| Browser credential | [Tokens API/docs](https://docs.mapbox.com/api/accounts/tokens/) | Public `pk` token only | URL restrictions can block mismatched origins. Secret `sk` tokens must never be shipped. Restrict origins and scopes and rotate on leak.[8] |

### Contractual go/no-go

The open-source renderer recommendation and Mapbox’s documented display restrictions are in tension: **MapLibre is not a Mapbox library/SDK**. Geocoding documentation says results may only be used with a Mapbox map, and Map Matching is more explicit. Before committing to MapLibre + those APIs, obtain written Mapbox confirmation/contract language that the intended rendering/export use is allowed. Otherwise choose one of:

- Mapbox GL JS as renderer (browser-capable, maintained, but current releases use a proprietary Mapbox license, so the shipped stack is no longer fully open source).
- A separately hosted/self-hosted open geocoder/router/map matcher (adds a backend or third-party service, violating the “only Mapbox APIs” network constraint).
- Remove the restricted features.

This is the largest product risk, not a technical implementation detail.

## Export architecture

### Canonical document

Store a versioned object containing page size (mm), bleed, DPI intent, bounds/camera/projection, frozen style reference, route/feature GeoJSON, legend/text blocks, font references, layer order/visibility, and provenance/attribution. Never derive project truth from current DOM/canvas pixels.

### High-resolution algorithm

1. Convert physical size to pixels only for raster targets: `px = round(mm / 25.4 × dpi)`.
2. Query WebGL `MAX_TEXTURE_SIZE` and respect MapLibre’s `maxCanvasSize`; a 24×36 inch, 300-DPI page is 7200×10800 and cannot be assumed to fit one WebGL canvas.
3. Render basemap tiles/strips with overlap, crop seams, and stitch into the target or keep multiple clipped images in SVG/PDF.
4. Project route/annotation coordinates into print coordinates and draw them independently as SVG vectors.
5. Wait for style, tiles, images, and `document.fonts.ready`; freeze animations and DPR.
6. Embed attribution, fonts (when allowed), and image assets. Record missing-tile failures rather than exporting a silently incomplete map.

MapLibre v6 exposes `pixelRatio`/`setPixelRatio`, but the documented canvas cap defaults to 4096 square and should not be raised above the GPU texture limit. `preserveDrawingBuffer` is false by default; a dedicated short-lived export map or synchronous capture immediately after render is safer than leaving it enabled globally.

### Formats

- **SVG:** serialize the print scene with named `<g>` groups. Basemap is one or more embedded PNG/WebP images; overlays remain vector. This is genuinely layered SVG, but not an all-vector map.
- **PNG:** resvg-wasm from the SVG, tiled for very large dimensions. Browser `canvas.toBlob()` is a simpler fallback but PNG’s nominal 96-DPI metadata is not a print guarantee; physical dimensions must be communicated and tested.
- **PDF:** svg2pdf.js + jsPDF, explicit page dimensions, fonts, crop/bleed marks; basemap embedded at sufficient effective PPI. Add a preflight check for missing fonts/images and low-PPI raster layers.
- **PSD:** rasterize each top-level SVG group at target dimensions, transfer RGBA buffers to ag-psd, and write named RGB layers plus a valid flattened composite. Cap dimensions/layers/bytes before allocation.

## Print, DPI, and color management

Browser CSS `@page` and **Paged.js** are useful for previewing page breaks and simple print sheets, but the browser print dialog is not a deterministic production export. Paged.js is MIT, repo-pushed 2026-04-23, and works in-browser; its PDF CLI uses Puppeteer and is therefore not client-only.

Treat **DPI as raster sampling**, not a property that makes SVG/PDF “high resolution.” Keep dimensions in mm/pt and vectors as vectors; calculate effective PPI for each raster.

### CMYK conclusion

A trustworthy press-ready **PDF/X + ICC + calibrated CMYK + overprint/spot-color** pipeline is not realistically delivered by this recommended browser stack. ag-psd explicitly writes RGB only. jsPDF/svg2pdf.js are general PDF generators, not a documented PDF/X preflight/color-management system.

Possible experimental building blocks:

| Candidate | License / maintenance | Browser compatibility | Role | Caveat |
|---|---|---|---|---|
| [wasm-vips](https://github.com/kleisauke/wasm-vips) | MIT; npm 0.0.18 2026-06-09; repo pushed 2026-08-18 | Chrome 95+, Firefox 100+, Safari 16.4+ per project; requires Wasm SIMD/exception handling, `SharedArrayBuffer`, and COOP/COEP cross-origin isolation | High-throughput image conversion/resampling; potentially ICC-related image operations if included in the build | Large binary/memory footprint; cross-origin isolation complicates third-party assets; verify the exact build’s ICC/CMYK operators. It still does not make jsPDF output PDF/X.[18] |
| [lcms-wasm](https://github.com/mattdesl/lcms-wasm) | MIT; npm 1.0.5/repo push 2025-01-08 | Browser Wasm | ICC pixel conversions using LittleCMS | Small project and only a conversion primitive. Correct profiles, rendering intent, black generation, PDF output intents, and preflight remain application responsibilities. |

Recommended product wording: export **RGB SVG/PNG/PDF/PSD**, allow a printer to convert using its target profile, and clearly label the output “not PDF/X/press-certified.” If CMYK/PDF-X is mandatory, add a proven native/server prepress stage and relax the browser-only constraint.

## Import/export details

- **GeoJSON:** native `JSON.parse`/`JSON.stringify`, then check-geojson and application limits. Preserve foreign members intentionally.
- **GPX/KML import:** toGeoJSON.[10]
- **GPX export:** [togpx](https://github.com/tyrasd/togpx), MIT, browser-capable, repo last code push 2023-11 but npm 0.5.4 dates to 2017. Treat as a small auditable fallback or implement the required GPX 1.1 subset with `XMLSerializer`; write round-trip fixtures.
- **KML export:** [tokml](https://github.com/mapbox/tokml), BSD-2-Clause. Repo saw maintenance activity 2026-06, but npm 0.4.0 dates to 2016. It handles common GeoJSON→KML; styling/extensions and round trips are lossy. A small schema-specific serializer may be lower risk.
- **Downloads:** construct `Blob` + object URL; revoke URLs. For large exports, test browser memory limits and optionally use the File System Access API only as a Chromium enhancement, never as the sole save path.

## Alternatives (not the default)

| Area | Candidate / exact URL | License | Maintenance signal | Browser compatibility / role | Why not default |
|---|---|---:|---|---|---|
| Renderer | [OpenLayers](https://github.com/openlayers/openlayers) | BSD-2-Clause | npm `ol` 10.10.0 published 2026-07-27; pushed 2026-08-20 | Modern browser; very broad raster/vector/source/projection support | Excellent GIS alternative, but MapLibre style/vector-tile ecosystem and PMTiles integration are a closer fit for styled consumer maps. |
| Renderer | [Leaflet](https://github.com/Leaflet/Leaflet) | BSD-2-Clause | stable npm 1.9.4 (2023-05); repo pushed 2026-08-17 | Broad browser support; DOM/SVG/canvas layers | Lightweight and mature, but raster-first and plugin-heavy for vector-tile styling/high-density print. |
| Editing | [Mapbox GL Draw](https://github.com/mapbox/mapbox-gl-draw) | ISC | repo pushed 2026-08-17 | Browser with Mapbox GL JS; often used with compatibility shims | Terra Draw has an explicit MapLibre adapter and avoids coupling to Mapbox GL internals. |
| Quick export | [maplibre-gl-export](https://github.com/watergis/maplibre-gl-export) (`@watergis/maplibre-gl-export`) | MIT | npm 5.0.0 published 2026-07-24; repo pushed 2026-08-20 | Browser; current peer range MapLibre 5.21/6.x; JPEG/PNG/PDF/SVG at 72–400 DPI | Useful prototype/reference, not the print core: its code wraps a composed raster canvas in PDF/SVG, so those outputs are not vector/layered. Source comments say A0/A1 are not working well. Documentation URL linked from README returned 404 during research.[11] |
| PDF manipulation | [pdf-lib](https://github.com/Hopding/pdf-lib) | MIT | latest npm 1.17.1 is 2021-11; repo pushed 2024-07 | Browser; create/modify PDFs, embed pages/fonts/images, draw paths/text | Better if importing or stamping existing PDFs. Less direct than svg2pdf.js for a DOM SVG scene; maintenance/release cadence is slower. Not PDF/X. |
| Print layout | [Paged.js](https://github.com/pagedjs/pagedjs) | MIT | npm 0.4.3 2023-07; repo pushed 2026-04 | Browser paged-media polyfill | Good for multipage prose/templates, not deterministic GPU map capture or prepress output. |
| SVG rasterizer | Browser Canvas `drawImage`/`toBlob` | Web standard | Baseline browser API | No dependency | Less deterministic across engines, weak font/filter fidelity, canvas dimension limits, and raster-only. |
| SVG rasterizer | [resvg-wasm](https://github.com/thx/resvg-js) | MPL-2.0 | See recommended table | Wasm browser | Better fidelity but larger payload/memory and a less recent wasm npm release.[14] |
| Persistence | [idb](https://github.com/jakearchibald/idb) | ISC | npm 8.0.3/repo push 2025-05-07 | Tiny promise wrapper over IndexedDB | Choose when the schema is simple. Dexie migrations/query ergonomics are preferable for a document editor. |
| Routing UI | [BRouter-web](https://github.com/nrenner/brouter-web) | MIT | repo pushed 2026-08-14 | Browser client | It explicitly depends on a separate BRouter backend; it is not in-browser routing.[22] |
| Open routing engine | [Valhalla](https://github.com/valhalla/valhalla) | MIT | pushed 2026-08-21 | C++ server/native engine; routing, alternatives, map matching, isochrones | Strong self-host option but not a maintained browser-Wasm full-world engine; demo service is not a production SLA.[23] |
| Open routing engine | [OSRM](https://github.com/Project-OSRM/osrm-backend) | BSD-2-Clause | pushed 2026-08-17 | C++ server; route/table/match APIs | Fast, mature, but requires preprocessing and a server. Public demo has a usage policy and is not a production dependency.[24] |
| Open routing engine | [GraphHopper](https://github.com/graphhopper/graphhopper) | Apache-2.0 | pushed 2026-08-19 | Java library/server; directions, alternatives, map matching | Requires a server/hosted API; not browser-only. Rich custom profiles but operationally heavier.[25] |

### Routing conclusion

There is no recommended maintained permissive full-world **client-only** JS/Wasm router/map matcher that can replace Mapbox while remaining a small static web app. The routing graph and preprocessing dominate storage/memory, and the maintained open engines are servers/native libraries. A region-limited experimental Wasm router is possible, but it becomes a separate R&D/data-distribution project. Under the stated constraints, Mapbox Directions/Map Matching are the practical path—subject to the display-term issue above.

## Testing and acceptance gates

1. **Unit/property:** coordinate↔print transforms, mm/pt/px conversions, route chunk stitching, serializers, schema migrations, layer ordering.
2. **Fixture round trips:** GPX/KML/GeoJSON with tracks, routes, holes, Unicode, altitude/time, malformed XML, huge coordinate counts.
3. **Cross-browser E2E:** Playwright Chromium/Firefox/WebKit; fixed DPR; mocked Mapbox/tile responses; offline/error/429 cases; URL-restricted-token errors.
4. **Export structure:** parse SVG XML and assert named groups; parse PDF page/media boxes/font/image objects; read generated PSD back with ag-psd and assert dimensions/layers/composite.
5. **Visual:** pixelmatch with tolerance and deterministic fonts/fixtures; keep separate baselines per engine when unavoidable.
6. **Print preflight:** page/bleed/crop dimensions, effective raster PPI, missing fonts/images/tiles, attribution, maximum memory estimate, output color-space warning.
7. **Security:** XML/GeoJSON size limits, no unsanitized HTML from imported descriptions or geocoder results, CSP, token scope/origin restrictions, object-URL cleanup.

## Bottom line

The browser-only product is technically feasible for interactive editing and high-quality **RGB** SVG/PNG/PDF, and feasible for **layered raster RGB PSD**. The two hard boundaries are:

- MapLibre’s WebGL basemap cannot become a fully editable layered vector export without a separate print renderer.
- A production CMYK/PDF-X pipeline needs a non-browser prepress component or a deliberately experimental scope.

Resolve Mapbox’s map-display terms before implementation; otherwise the most attractive open renderer may be contractually incompatible with Geocoding/Map Matching responses.

## Sources

[1] https://maplibre.org/maplibre-gl-js/docs
[2] https://maplibre.org/maplibre-style-spec
[3] https://github.com/protomaps/PMTiles
[4] https://docs.mapbox.com/api/search/geocoding
[5] https://docs.mapbox.com/api/search/search-box
[6] https://docs.mapbox.com/api/navigation/directions
[7] https://docs.mapbox.com/api/navigation/map-matching
[8] https://docs.mapbox.com/api/accounts/tokens
[10] https://github.com/placemark/togeojson
[11] https://github.com/watergis/maplibre-gl-export
[14] https://github.com/thx/resvg-js
[15] https://github.com/Agamnentzar/ag-psd
[18] https://github.com/kleisauke/wasm-vips
[22] https://github.com/nrenner/brouter-web
[23] https://github.com/valhalla/valhalla
[24] https://github.com/Project-OSRM/osrm-backend
[25] https://github.com/graphhopper/graphhopper
