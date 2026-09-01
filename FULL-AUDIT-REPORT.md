# Print Map Studio SEO Audit

**Site:** https://printmaps.yasoob.me/
**Audit date:** 2026-08-31
**Business type:** Free browser-based design application
**Overall SEO health score:** **70/100**

## Executive summary

Print Map Studio has a strong technical and performance foundation: the marketing page is statically rendered, the editor is correctly excluded from indexing, metadata and social cards are complete, structured data is present, and measured lab performance is good.

The immediate problem is discovery rather than page quality. Google Search Console reports the homepage as **unknown to Google**, no sitemap is submitted, and there are no impressions or clicks in the last 90 days. DataForSEO likewise found no domain ranking or backlink record, and the site did not appear in the first 20 results for the branded query `print map studio`. The deployment was updated on the audit date, so some of this is consistent with a new site.

The largest on-site opportunities are stronger trust/entity signals, a searchable homepage title, more indexable content for specific use cases, and lighter feature screenshots.

### Weighted scorecard

| Category | Weight | Score | Weighted |
|---|---:|---:|---:|
| Technical SEO | 22% | 67 | 14.7 |
| Content quality | 23% | 49 | 11.3 |
| On-page SEO | 20% | 85 | 17.0 |
| Schema / structured data | 10% | 78 | 7.8 |
| Performance | 10% | 93 | 9.3 |
| AI search readiness | 10% | 62 | 6.2 |
| Images | 5% | 64 | 3.2 |
| **Overall** | **100%** |  | **70** |

### Critical issue

1. **The homepage is unknown to Google.** Search Console URL Inspection returned `URL is unknown to Google`, no sitemap is submitted, and there is no search performance data. Submit `https://printmaps.yasoob.me/sitemap-index.xml`, inspect the homepage, and request indexing.

### Top quick wins

1. Submit the sitemap and request homepage indexing in Search Console.
2. Change the homepage title from `Print Map Studio` to a descriptive title such as `Print Map Studio - Free Printable Map Maker`.
3. Surface `Free`, `No account`, and `No watermark` near the primary CTA.
4. Add publisher/creator identity, a privacy notice, and a contact route.
5. Add `fetchpriority="high"` to the hero image and convert the three large feature screenshots to WebP or AVIF.

## Scope and evidence

- Crawled `robots.txt`, the sitemap index, the child sitemap, `/`, and `/editor/`.
- Found two HTML routes: one indexable marketing page and one intentionally noindexed editor.
- Parsed initial HTML with the Codex SEO fetcher and a rendered DataForSEO browser pass.
- Captured desktop and mobile screenshots in `screenshots/`.
- Collected Google Search Console property, URL Inspection, sitemap, and 28/90-day performance evidence.
- Collected DataForSEO on-page, domain-rank, backlink, and branded SERP snapshots.
- Ran a local Lighthouse audit and specialist technical, content, schema, sitemap, performance, visual, GEO, image, SXO, and backlink reviews.

## Technical SEO

### What works

- `/` and `/editor/` return HTTP 200 over HTTPS.
- HTTP redirects to HTTPS in one 301 hop.
- `robots.txt` allows crawling and references the correct sitemap index.
- The homepage has a self-referencing canonical.
- `/editor/` has `noindex,follow`, a self-referencing canonical, and is correctly absent from the sitemap.
- The homepage content, metadata, and JSON-LD are present in initial HTML; they do not depend on client rendering.
- URLs are clean and trailing-slash behavior is consistent.

### Issues

| Priority | Finding | Evidence |
|---|---|---|
| Critical | Homepage not discovered/indexed | GSC: `URL is unknown to Google`; no last crawl or canonical |
| High | Sitemap not submitted in Search Console | GSC returned no sitemaps |
| Medium | Security headers are absent on successful HTML responses | No HSTS, CSP, X-Content-Type-Options, Referrer-Policy, frame policy, or Permissions-Policy observed |
| Low | `/sitemap.xml` returns 404 | Robots correctly declares `/sitemap-index.xml`, so this is compatibility rather than a crawl blocker |
| Low | Sitemap has no `<lastmod>` | Valid but missing a useful freshness hint |

The site is served by GitHub Pages, which does not provide arbitrary response-header configuration. Security headers require an edge proxy/CDN or a host that supports custom headers.

## Sitemap and indexability

The sitemap chain is valid:

```text
/robots.txt
  -> /sitemap-index.xml
      -> /sitemap-0.xml
          -> https://printmaps.yasoob.me/
```

Coverage is correct: the only indexable page is present, and the noindexed editor is excluded. The primary issue is that the sitemap has not been submitted to Search Console.

The `SoftwareApplication.url` property currently points to `/editor/`, which is noindexed. Use the indexable homepage as the entity URL and link to the editor with a more specific property or CTA.

## Content quality and E-E-A-T

### What works

- The homepage contains roughly 1,030 words.
- The FAQ answers practical questions about storage, imports, exports, file formats, routing dependencies, and product limitations.
- Use-case copy addresses publishing, tourism, real estate, events, posters, and planning.
- Readability is good: DataForSEO measured a Flesch-Kincaid score of 60.9 and an automated readability index of 7.0.
- Product limitations are disclosed clearly rather than hidden.

### Issues

- No privacy, terms, about, support, or contact page exists.
- Google Analytics is active, but visitors have no linked analytics/privacy disclosure.
- No named creator or publisher appears in the content or structured data.
- The footer has no external profile, source, or contact links.
- One indexable page cannot establish topical depth for non-branded searches.
- There are no tutorials, examples, downloadable samples, changelog entries, or comparison content.

This is the weakest weighted category. The copy itself is strong; the low score reflects missing trust and depth around it.

## On-page SEO and search experience

### What works

- One clear H1: `Beautiful maps. Ready to print.`
- Logical H2/H3 hierarchy.
- Complete canonical, Open Graph, Twitter card, favicon, language, and viewport metadata.
- Strong direct CTA to the editor with no signup gate.
- DataForSEO on-page score: **95.24/100**.
- Desktop and mobile renders are visually clear with no horizontal overflow.

### Issues

| Priority | Finding |
|---|---|
| High | The title is only 16 characters and brand-only; it does not target `printable map maker`, `map maker for print`, or similar intent |
| Medium | The 177-character meta description is likely to be truncated and omits the strongest conversion signals: free, no account, no watermark |
| Medium | `Free` and `No account required` are buried in the FAQ instead of shown near the CTA |
| Medium | The page describes the editor rather than embedding it; intent-specific landing pages are needed to compete for non-branded searches |
| Medium | Finished map outputs and sample exports are absent; screenshots show the interface, not the result |
| Low | Mobile hides the in-page navigation links, although the primary editor CTA remains prominent and the page is fully scrollable |

DataForSEO returned 18 organic results for `print map studio`; Print Map Studio did not appear in the first 20. Competing results include `mapstudio.art`, `printmaps.net`, `mapstudio.ai`, and Mapbox Studio, indicating substantial brand and query ambiguity.

## Schema and structured data

### Present and valid

- `WebSite`
- `SoftwareApplication`
- `FAQPage` with visible matching FAQ content

### Recommended changes

1. Add a `Person` or `Organization` entity and reference it from `WebSite.publisher` and `SoftwareApplication.author` or `creator`.
2. Change `operatingSystem` from `Any modern web browser` to `Web`.
3. Add a real `screenshot`, `inLanguage`, `datePublished`, and `dateModified` where maintainable.
4. Avoid adding `aggregateRating` until genuine ratings exist.
5. Point the application's primary entity URL at the indexable homepage rather than the noindexed editor route.

Commercial sites are not eligible for Google's FAQ rich results. The existing `FAQPage` markup is therefore an informational, not critical, issue; it may still help non-Google consumers understand the content. Do not add more FAQ markup solely for Google visibility.

## Performance and Core Web Vitals

### Measured lab results

| Metric | Result | Assessment |
|---|---:|---|
| Lighthouse performance | 93/100 | Good |
| LCP | 1.75 s | Good |
| INP audit value | 152 ms | Good |
| CLS | 0.03 | Good |
| TBT | 106 ms | Good |
| Lighthouse SEO | 92/100 | Good |
| Accessibility | 90/100 | Good |
| Best practices | 88/100 | Needs minor improvement |

DataForSEO's rendered pass measured LCP at 564 ms, time to interactive at 218 ms, and an on-page score of 95.24. These are synthetic measurements, not field data.

No CrUX field data was available, so real-user LCP, INP, and CLS remain unknown.

### Performance opportunities

- Add `fetchpriority="high"` to the above-the-fold hero image.
- Keep the hero eager; do not lazy-load it.
- Defer non-critical third-party analytics further only if measured attribution and performance tradeoffs justify it.
- Convert below-fold PNG screenshots to WebP/AVIF.

## Image SEO

### What works

- Images have explicit width and height, limiting CLS.
- The hero uses responsive mobile, tablet, and desktop WebP sources.
- Feature screenshots are lazy-loaded.
- Feature screenshot alt text is descriptive.
- The empty logo alt text is appropriate because adjacent brand text supplies the accessible name.

### Issues

| Asset | Transfer size | Finding |
|---|---:|---|
| `design-desktop.png` | 698 KB | Large legacy PNG |
| `export-desktop.png` | 509 KB | Large legacy PNG |
| `content-desktop.png` | 345 KB | Large legacy PNG |
| `editor-new-york.webp` | 257 KB | Reasonable but can be compressed further |
| `free-sticker.png` | 84 KB | Could be SVG/WebP; alt should be descriptive or empty if decorative |
| `logo.png` | 36 KB | Could be SVG/WebP |

The three desktop feature screenshots total about 1.55 MB before mobile variants. Converting them is the largest straightforward byte reduction.

## AI search readiness

### Strengths

- AI crawlers are allowed by the global robots rule.
- The homepage is fully server-rendered.
- FAQ answers are concise, self-contained, and easy to quote.
- Product, price, features, export formats, and data sources are explicitly described.
- Brand naming is consistent across metadata, content, and schema.

### Gaps

- `/llms.txt` and `/llms-full.txt` return 404.
- Creator/publisher identity and external profile links are absent.
- No date/freshness signals, changelog, documentation, or long-form supporting content exists.
- The site links to no authoritative source pages despite relying on OpenStreetMap/OpenFreeMap/OpenMapTiles.

`llms.txt` is an emerging voluntary convention, not a demonstrated Google ranking factor. Treat it as a medium-priority discoverability aid after indexation, trust, and content work.

## Backlinks and authority

There is insufficient data for a defensible backlink health score.

- DataForSEO backlink summary returned an empty `items` array.
- The domain was not found in the two recent Common Crawl indices checked.
- No external reference surfaced in sampled Bing or GitHub searches.
- DataForSEO domain rank overview returned no items.
- There are no links to evaluate for toxicity.

These results mean no provider discovered a backlink profile; they do **not** prove that no backlinks exist. The immediate strategy should create linkable pages and launch the product in relevant mapping/design communities.

## Google Search Console

| Check | Result |
|---|---|
| Property | `sc-domain:printmaps.yasoob.me` |
| Permission | Site owner |
| Homepage URL Inspection | Neutral; URL unknown to Google |
| Last crawl | None |
| Google-selected canonical | None |
| Submitted sitemaps | None |
| Last 28 days | No performance data |
| Last 90 days | No query or page data |

## Prioritized findings

### Critical

1. Homepage unknown to Google and sitemap not submitted.

### High

1. No privacy/analytics disclosure, contact path, or creator/publisher identity.
2. No organic footprint detected in GSC, DataForSEO, Common Crawl, or the sampled branded SERP.
3. Homepage title does not target a searchable product category.
4. Only one indexable page exists, limiting topical authority and link acquisition.
5. Large PNG screenshots add roughly 1.55 MB of below-fold image payload.

### Medium

1. Missing publisher/entity links in structured data.
2. Missing security headers on GitHub Pages responses.
3. No finished-output gallery, sample export, testimonial, or other proof.
4. No `llms.txt`, documentation, changelog, or citable supporting pages.
5. Hero image lacks an explicit high-priority fetch hint.

### Low

1. Sitemap lacks `<lastmod>`.
2. Common `/sitemap.xml` alias returns 404.
3. Generator metadata exposes the Astro version.

## Limitations

- The site appears newly deployed, so the absence of GSC, ranking, and backlink data may primarily reflect age.
- CrUX field data was unavailable; performance findings use synthetic lab measurements.
- DataForSEO and Common Crawl coverage is not exhaustive.
- No conversion analytics or user-research data was available for SXO recommendations.
- The editor is intentionally noindexed and was evaluated only as a conversion destination, not as an organic landing page.
