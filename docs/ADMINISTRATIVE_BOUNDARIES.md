# Global administrative-boundary ingestion

## Decision

Replace the hand-maintained country catalogue with a generated global catalogue.

Natural Earth 10m Admin 1 is the primary source for countries and first-order subdivisions. Its published dataset contains more than 4,500 states/provinces, with names, variants and a mixture of ISO/HASC/FIPS identifiers; the source notes a few tiny countries and disputed areas without Admin 1 coverage.[1] Natural Earth permits modification, electronic distribution, printing, personal use and commercial use as public-domain data.[2]

If the product later needs worldwide county/municipality/district depth, integrate geoBoundaries as a second generated source. It describes global country coverage and about one million administrative boundaries across more than 200 entities under CC BY 4.0, which requires acknowledgement.[3]

## Runtime shape

This remains a static client-side product; it does not need a database server.

Generated assets:

- `index.json`: countries, available levels, names, stable IDs, shard URL, bounds and source version.
- `countries/<ADM0_A3>.json`: the selected Natural Earth entity's Admin 0 and Admin 1 geometries, keyed by Natural Earth's stable `ADM0_A3` identifier rather than an ISO filename guarantee.
- `manifest.json`: source URLs, versions, checksums, generation parameters and generated counts.

The picker loads the small index at startup and fetches one country shard only after selection. Once a boundary is added, its detached geometry and source metadata remain in `ProjectDocument`; autosave, reopen and export therefore do not depend on Natural Earth, geoBoundaries or any live API.

## Ingestion contract

1. Download a pinned source archive.
2. Verify its SHA-256 before extraction.
3. Convert source features into canonical Polygon/MultiPolygon GeoJSON.
4. Normalize Admin 1 IDs using a unique, syntactically valid ISO 3166-2 code for a recognized two-letter country when available, then stable Natural Earth source IDs as fallback.
5. Preserve Unicode names and source identifiers.
6. Validate unique IDs, finite coordinates, closed rings, legal longitude/latitude ranges, nonempty geometries and valid shard references.
7. Generate the index and country shards deterministically.
8. Fail generation if coverage unexpectedly shrinks or IDs collide.

The selected Natural Earth version is 5.1.1. The Admin 0 archive is 4,930,492 bytes with SHA-256 `ce1ac7036499a0edd641fbc093cd209a98f96a49d2eca8480aaacad35138a7f6`; the Admin 1 archive is 14,909,524 bytes with SHA-256 `efc59726337323058f9446210adc96673179cd344e053666ee3d28cb58ba2b05`. Both were fetched on 2026-08-26.

The 258 Admin 0 records are Natural Earth entities, not a claim of 258 ISO-recognized sovereign countries. The catalogue intentionally includes disputed territories, dependencies and other non-ISO entities represented by Natural Earth; their stable `ADM0_A3` identifiers may therefore differ from or have no ISO 3166-1 alpha-3 equivalent.

Run `npm run generate:administrative-boundaries` from the repository root. The generator uses a pinned `pyshp` environment through `uv`, caches only checksum-verified source archives, stages the complete output before replacement and emits deterministic compact JSON.

## Migration

1. Build and validate the generated catalogue beside the current hand-curated data.
2. Switch the picker and area lookup behind one repository interface.
3. Verify representative mainland, island, multipart, Unicode-name and missing-Admin-1 countries.
4. Verify merge, persisted geometry, autosave recovery and SVG/PDF/PNG export.
5. Remove all country-specific modules and country-specific catalogue tests in one cleanup commit.

Vienna's municipal district source remains an explicit exception until worldwide deeper-level ingestion is implemented.

## Sources

[1] [Natural Earth Admin 1 – States, Provinces](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/)

[2] [Natural Earth Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/)

[3] [geoBoundaries data and licensing](https://www.geoboundaries.org/index.html#getdata)
