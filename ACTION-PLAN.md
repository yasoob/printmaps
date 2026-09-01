# Print Map Studio SEO Action Plan

## Implementation status - August 31, 2026

Completed in the current branch:

- Submitted `sitemap-index.xml` to Google Search Console; Google reports it as valid with no errors or warnings.
- Added indexable About and Privacy pages with accurate local-storage, analytics, map-provider, and support disclosures.
- Added three distinct intent pages for printable maps, GPX imports, and layered exports.
- Rewrote homepage title and description around printable-map intent.
- Added creator, publisher, WebPage, and richer SoftwareApplication schema.
- Added `llms.txt` and a broader internal-link structure.
- Added WebP feature screenshots, reducing their combined payload from 2.55 MB to 562 KB.
- Added a high-priority hint for the hero image.
- Finalized hero variant A, removed the two pill rows, and removed the temporary review route and unused variants.

Remaining external work:

- Request homepage indexing in the Search Console UI after these changes are deployed. Google does not provide a general-purpose indexing-request API for ordinary pages.
- Security headers require a CDN/edge layer or a move away from direct GitHub Pages hosting.

## Critical: immediately

| Action | Effort | Expected impact | Verification |
|---|---:|---|---|
| Submit `https://printmaps.yasoob.me/sitemap-index.xml` in Google Search Console | 10 min | Enables direct discovery of the canonical homepage | GSC Sitemaps shows `Success` |
| Inspect `https://printmaps.yasoob.me/` and request indexing | 10 min | Starts the first crawl/indexing cycle | URL Inspection changes from `URL is unknown to Google` |
| Recheck indexing after 3-7 days | 10 min | Detects canonical, robots, or fetch problems early | GSC reports indexed or a specific exclusion reason |

## High: next 7 days

| Action | Effort | Expected impact | Implementation |
|---|---:|---|---|
| Add a privacy page with Google Analytics disclosure and link it in the footer | 0.5-1 day | Trust and compliance readiness | Add `src/pages/privacy.astro`; update `MarketingFooter.astro` |
| Add a visible contact/support route and identify the creator or publisher | 1-2 hr | Stronger E-E-A-T and user trust | Footer plus About/contact content |
| Rewrite the homepage title | 15 min | Better relevance and SERP CTR | Use `Print Map Studio - Free Printable Map Maker` or a tested equivalent |
| Tighten the meta description to about 150-160 characters | 15 min | Less truncation and stronger intent match | Lead with `Free`, `browser-based`, and `no account` |
| Surface `Free`, `No account`, and `No watermark` near the hero CTA | 30-60 min | Better conversion for first-time visitors | Update `MarketingHero.astro` |
| Add publisher/creator schema and enrich `SoftwareApplication` | 1-2 hr | Better entity resolution | Add publisher, creator, screenshot, `operatingSystem: "Web"`, dates |
| Convert all six feature screenshots to WebP or AVIF | 2-4 hr | Save roughly 1 MB or more | Update assets and `HomeFeatures.astro` sources |

## Medium: next 30 days

| Action | Effort | Expected impact | Verification |
|---|---:|---|---|
| Publish 3 focused landing pages | 2-4 days | Creates non-branded ranking surface | Target `GPX printable map`, `map maker for print`, and `layered SVG/PSD map export` |
| Publish one detailed tutorial or guide | 1 day | Creates a linkable asset | Example: `How to turn a GPX route into a print-ready map` |
| Add a finished-map gallery and downloadable sample | 1-2 days | Improves proof and conversion | Show PNG, PDF, SVG, and PSD outputs |
| Add `fetchpriority="high"` to the hero image | 5 min | Protects LCP on slower devices | Re-run Lighthouse mobile |
| Add `llms.txt` | 30-60 min | Gives AI agents a concise authoritative product summary | `/llms.txt` returns plain text and links canonical resources |
| Add accurate `<lastmod>` values to the sitemap | 1 hr | Better freshness signaling | Validate generated sitemap XML |
| Add a `/sitemap.xml` redirect or alias | 30 min | Better compatibility with generic tools | `/sitemap.xml` resolves to the sitemap index |
| Put the site behind an edge layer that supports security headers | 0.5-1 day | Adds HSTS, CSP, referrer, MIME, and frame protections | Confirm with `curl -I` |

## Authority and launch

1. Link the live product prominently from the GitHub repository and creator profile.
2. Submit the tool to Product Hunt, AlternativeTo, and relevant mapping/design directories.
3. Share a launch/demo with OpenStreetMap, MapLibre, cartography, GIS, and design communities.
4. Pitch the focused tutorials rather than the homepage when requesting links.
5. Re-run the backlink audit in 30-45 days; current providers have insufficient data for a baseline score.

## Measurement plan

| Cadence | Measure |
|---|---|
| Daily for first week | GSC URL Inspection and sitemap status |
| Weekly for first month | Impressions, indexed pages, branded query appearance, crawl errors |
| After each front-end change | Mobile Lighthouse LCP, CLS, TBT, accessibility |
| Monthly | DataForSEO domain visibility, branded SERP, backlinks, and GSC query/page trends |
| Quarterly | Full SEO, content, schema, GEO, and SXO re-audit |

## Recommended implementation order

1. Indexation and sitemap submission.
2. Privacy, contact, and publisher identity.
3. Homepage title, description, and hero trust messaging.
4. Schema enrichment.
5. Image conversion and hero priority.
6. Intent-focused landing pages and tutorial content.
7. Product launch and backlink acquisition.
