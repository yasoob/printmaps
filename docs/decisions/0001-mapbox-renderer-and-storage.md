# ADR 0001: Mapbox renderer, token and response-storage boundary

- Status: Accepted
- Date: 2026-08-23

## Context

Print Map Studio is a static browser application with an existing MapLibre renderer and open OpenFreeMap styles. The planned address search, snapped routes and map matching would introduce Mapbox API responses into a project that is autosaved and exported.

Mapbox documents public tokens as client-side credentials, recommends least privilege, and says a URL-restricted token works only for requests from allowed URLs.[1] Mapbox also says temporary Geocoding results cannot be cached, while permanent storage requires a valid credit card or enterprise contract.[3] The Map Matching API currently requires its results to be displayed on a Mapbox map using a Mapbox library or SDK.[4]

## Decision

1. The open editor, MapLibre renderer, imports, straight geometry tools, persistence and exports remain available without Mapbox.
2. Mapbox-backed search, directions-derived durable content and map matching stay disabled until their complete workflow uses a compliant Mapbox display path or written Mapbox approval explicitly permits the intended MapLibre display/export use.
3. If Mapbox-backed map matching is enabled, the interactive renderer will switch to Mapbox GL JS behind the existing map-adapter boundary. Open-only projects may continue to use MapLibre.
4. Temporary Geocoding or Search responses will not enter the canonical project, IndexedDB autosave or portable files. Durable provider coordinates require an explicitly permanent request, deployment eligibility and provenance recorded in the canonical document.
5. Mapbox content will not be silently incorporated into the independent PNG, PDF or layered SVG paths. Any future provider-backed export requires a separate terms and attribution review.

## Browser token setup

- Deployment supplies `VITE_MAPBOX_PUBLIC_ACCESS`; only a syntactically valid `pk.` public token is accepted. Secret `sk.` tokens are rejected before any request.
- The token is never rendered, written to project state, IndexedDB or portable files, or included in diagnostics.
- The Project properties panel always reports missing/invalid configuration with the exact browser origin and corrective setup guidance.
- A user-triggered connection check requests the stable Mapbox Streets style endpoint through the provider request boundary. A successful response proves only that the public token, current origin, network and style-read access work; it does not unlock provider-dependent authoring.
- HTTP 401, 403, 422, 429, offline and network failures retain the provider core's actionable normalized messages. A 403 explicitly directs the operator to token scopes and allowed-URL restrictions for the current origin.

## Consequences

This decision resolves the renderer/storage gate without pretending that a valid token grants broader contractual permission. The current open-map editor remains useful and exportable, deployment errors are visible and testable, and later search/routing work has a hard fail-closed boundary instead of leaking temporary provider data into durable projects.

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
