# ADR 0001: Mapbox renderer, token and response-storage boundary

- Status: Accepted, amended after project-owner permission confirmation
- Date: 2026-08-23

## Context

Print Map Studio is a static browser application with an existing MapLibre renderer and open OpenFreeMap styles. The planned address search, snapped routes and map matching would introduce Mapbox API responses into a project that is autosaved and exported.

Mapbox documents public tokens as client-side credentials, recommends least privilege, and says a URL-restricted token works only for requests from allowed URLs.[1] Mapbox also says temporary Geocoding results cannot be cached, while permanent storage requires a valid credit card or enterprise contract.[3] The Map Matching API currently requires its results to be displayed on a Mapbox map using a Mapbox library or SDK.[4]

On 2026-08-24, the project owner confirmed full permission for the intended Mapbox search, routing, map-matching, persistence and export workflows. That authorization removes the contractual gate below; token safety, provenance, request bounds and graceful fallback remain required engineering controls.

## Decision

1. The open editor, MapLibre renderer, imports, straight geometry tools, persistence and exports remain available without Mapbox.
2. Mapbox-backed address search, directions and map matching may be implemented immediately as one complete workflow behind the existing provider/map-adapter boundaries.
3. The implementation may use Mapbox GL JS where required while open-only projects continue to use MapLibre.
4. Selected search results and snapped route geometry may enter the canonical project, IndexedDB autosave and portable files. Store only the durable data needed by the project, record provider provenance and never serialize credentials or raw diagnostic responses.
5. Provider-derived route geometry may participate in PNG, PDF and layered SVG exports with the same visual and attribution contract as other canonical routes. Export code must remain deterministic and must not depend on a live provider response after the route is committed.

## Browser token setup

- Deployment supplies `VITE_MAPBOX_PUBLIC_ACCESS`; only a syntactically valid `pk.` public token is accepted. Secret `sk.` tokens are rejected before any request.
- The token is never rendered, written to project state, IndexedDB or portable files, or included in diagnostics.
- The Project properties panel always reports missing/invalid configuration with the exact browser origin and corrective setup guidance.
- A user-triggered connection check requests the stable Mapbox Streets style endpoint through the provider request boundary. A successful response proves only that the public token, current origin, network and style-read access work; it does not unlock provider-dependent authoring.
- HTTP 401, 403, 422, 429, offline and network failures retain the provider core's actionable normalized messages. A 403 explicitly directs the operator to token scopes and allowed-URL restrictions for the current origin.

## Consequences

The open-map editor remains useful without Mapbox, while an authorized Mapbox-backed workflow can now provide address search and road-snapped routes. Provider failures remain visible and recoverable; credentials stay outside projects; committed route geometry remains locally editable, portable and exportable.

## Sources

[1] https://docs.mapbox.com/help/dive-deeper/access-tokens — Mapbox Access Tokens
    > "Public tokens are designed to be used in client-side applications, meaning they can be safely exposed in web browsers, mobile apps, and other client environments."
    > "They should be configured with the least amount of access necessary to limit exposure."
    > "When you add a URL restriction to a token, that token will only work for requests that originate from the URLs you specify."
[3] https://docs.mapbox.com/api/search/geocoding — Mapbox Geocoding API
    > "Temporary results are not allowed to be cached, while Permanent results are allowed to be cached and stored indefinitely."
    > "Using Permanent storage with the Geocoding API requires that you have a valid credit card on file or an active enterprise contract."
[4] https://docs.mapbox.com/api/navigation/map-matching — Mapbox Map Matching API
    > "Results must be displayed on a Mapbox map using one of the Mapbox libraries or SDKs."
