# Map style preset gallery plan

Evidence refreshed: 2026-08-24 UTC.

## Reference evidence

- User-provided HAR source: `https://filebin.net/huvoazr7zjknzprg/mapiful-com.har`
- Downloaded size: 61,365,756 bytes
- SHA-256: `27ae1105e7557975212523edbfc1a2d1d151cfe55b40ebdd674690351e0e33b8`
- HAR 1.2 contained 624 requests. The relevant public editor traffic comprised 122 `universal-editor.pages.dev` requests and 441 Mapiful tile requests.
- The public editor bundle exposes an effective two-level system: 11 curated design combinations over 16 underlying map palettes. This confirms the useful product pattern but is not a production dependency.
- The raw HAR contained Cookie headers. It stays outside the repository and must not be committed, delegated, or used as a credential source. Only the non-secret architectural observations below are retained.

## Product contract

Print Map Studio will provide an original visual preset gallery built entirely on its existing OpenFreeMap/OpenMapTiles pipeline. Mapiful names, code, images, CSS, tile URLs, high-resolution services, and other proprietary assets are research references only and must not ship.

### Information architecture

1. **Theme family filter** — a small intent-level grouping: Minimal, Editorial, Dark, Soft, Natural, Playful.
2. **Map style cards** — actual canonical presets saved in the project and used by live rendering and print export.
3. **Advanced map details** — existing language, text scale, and feature visibility remain independent controls below the gallery.

The gallery uses a 3-column desktop / 2-column mobile grid. Cards contain deterministic first-party thumbnails, an original preset name, and an accessible selected state. Unselected cards remain visually quiet; the selected card uses one dark outline/check. The grid must not create live MapLibre instances.

## Semantic style model

Every preset defines named cartographic roles rather than arbitrary replacements:

- canvas
- land
- water
- park
- building
- major road
- minor road
- boundary
- transit
- label
- label halo

All presets derive from one compatible OpenFreeMap layer structure so language, text scaling, visibility controls, camera state, overlay ordering, hit testing, native PNG, layered SVG, and PDF behavior remain stable.

## Initial original preset collection

These are Print Map Studio concepts, not copies of external style names or palettes. Exact values may be adjusted after contrast and screenshot review.

| Preset | Family | Direction |
|---|---|---|
| Paper | Minimal | Warm off-white paper, charcoal labels, restrained neutral roads |
| Graphite | Minimal | Near-monochrome cool gray with high editorial legibility |
| Porcelain | Editorial | Bright gallery surface, subtle blue-gray water and fine boundaries |
| Sandstone | Editorial | Warm stone land, clay buildings, deep brown typography |
| Night Ink | Dark | Near-black canvas, cool dark water, ivory labels, muted gold transit |
| Blueprint | Dark | Deep navy field, cyan water/roads, pale technical labels |
| Sea Glass | Soft | Pale aqua water, cream land, desaturated teal and slate typography |
| Rosewater | Soft | Blush-neutral land, cool pale water, plum-gray labels |
| Alpine | Natural | Soft sage parks, mineral water, warm-gray terrain and roads |
| Coastal | Natural | Stronger sea/land contrast with fresh vegetation and navy labels |
| Terracotta | Playful | Warm clay accents, cream roads, muted blue water, dark cocoa labels |
| Signal | Playful | Clean neutral base with one energetic coral/red map accent |

## Generation and thumbnail strategy

- Implement one preset registry with stable IDs, family, label, description, semantic tokens, and thumbnail path.
- Compile preset JSON from one same-origin base style at development/build time; generated styles remain deterministic and committed or hash-verified.
- Generate all thumbnails from the same representative Vienna center/zoom, viewport, language, and visibility state. Commit bounded WebP/PNG thumbnails; do not fetch Mapiful previews at runtime.
- Provide one shared attribution adjacent to the preview gallery for the underlying open map data.
- Keep thumbnail generation out of normal client startup and out of every test run.

## Interaction and persistence

- Selecting a card previews immediately and commits one undoable project transaction.
- Keyboard arrow navigation follows the visual grid; Enter/Space selects; focus and selected state are distinct.
- Style switching preserves language, text scale, all visibility categories, camera/lock state, content layers, selection, assets, and history invariants.
- Replace the pre-release schema atomically; obsolete drafts may receive the existing reset guidance.

## Verification

Per preset:

- registry/schema validation;
- required semantic roles and contrast checks;
- same-origin style/source constraints;
- stable OpenFreeMap layer structure;
- language/text-scale/visibility restoration;
- native PNG and vector-overlay export readiness;
- deterministic thumbnail dimensions/hash.

Gallery acceptance:

- desktop 3-column and mobile 2-column containment;
- keyboard navigation and selection;
- one-step Undo/Redo;
- JSON/ZIP/IndexedDB round-trip;
- style switch does not lose map content or canonical viewport;
- screenshot review across at least representative Minimal, Dark, Natural, and Playful presets;
- clean browser console and no horizontal overflow.
