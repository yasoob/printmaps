# Printmaps.net public product-capability inventory (outside the live editor)

**Research date:** 2026-08-21 UTC. **Scope:** public Printmaps marketing/use-case pages, English Support/Knowledge Base, pricing, FAQ/AI-information, legal/privacy pages, the Maptoolkit Printmaps API and its linked Static Maps API documentation. I did **not** interact with the live map editor, create an account, submit a ticket, or start checkout/payment.

## 1. Product boundary and positioning

- Printmaps.net is documented as a browser-based editor/shop for **static, print-ready digital cartography**, operated by Maptoolkit/Toursprung GmbH, using OpenStreetMap data. It delivers digital files rather than printing or shipping; it is not turn-by-turn navigation, a GIS analysis package, or (as the self-service product) an interactive-map/embed SDK.[8]
- Public pages say a user can begin designing without signup. Target users include graphic/layout designers, publishers, agencies, tourism organizations, events, real estate, and individuals producing posters or photobooks.[8]
- Coverage is documented as worldwide at all zoom levels, with hillshading, geocoding, and geographic shapes in almost all countries. The feature page advertises scales from the whole world down to **1:1,000 / individual houses**.[3][4]
- Support identifies the map reference/projection as **WGS84 / EPSG:3857 (Web Mercator)** and says cartography is refreshed with new data **every two weeks**.[11][12]

## 2. Verified self-service map capabilities documented outside the editor

### A. Base-map design and framing

- Choose predefined print sizes or enter custom width/height in **millimetres**; another first-party page also says the size control supports mm or inches. Pan/drag to set the frame, zoom, then lock the map area.[3][8]
- Maximum editor canvas documented by current detailed pages: **1,330 × 1,330 mm**. PNG becomes unavailable when either side exceeds **220 mm**; PSD or SVG remains available, subject to format caps below.[3][8]
- Rotate in any direction and tilt up to **60°**. Technical caveat: a tilted or rotated map cannot be bought as SVG; only PSD or PNG.[3]
- Choose from predefined map styles. Public descriptions include terrain, winter, city, and styles matching Komoot/Bikemap/CityMaps2Go. The AI-information page states **11 default styles**.[3][8]
- Use printable aerial imagery as the background in **selected countries**.[3]
- Show/hide individual map features, map layers, and labels. Examples explicitly name roads, road casings, cities, and water labels; features absent at the current extent/zoom may be greyed out.[3][19]
- Reduce map detail by up to half, or enable “Ultra High-Res Maps” to display the detail of one zoom step above the current zoom.[3][19]
- Global text-scale control changes label sizes while keeping the selected extent. Individual labels can instead be resized later in Photoshop/Illustrator.[3][4]
- Label-language choices documented in Support: local language, English, German, French, Italian, Spanish, or Chinese; missing translations fall back to the local name.[19]
- Base maps are generated in RGB by default; the site says users can convert to CMYK in image-processing software.[8]

### B. Routes and uploaded geodata

- Route tool has **Easy** and **Expert** modes. Easy mode accepts searched addresses/POIs and draws the fastest path on known roads. Expert mode places points on-map, permits insertion of intermediate points by dragging, and supports magnet-to-road, straight-line, and arc-line drawing.[18]
- Customize route line color and thickness and show/hide travel-mode icons. Public documentation names plane, train, car, walking, cycling, and ship; road-snapping is documented for pedestrian/bicycle/car, while straight/arc lines cover the non-road modes.[3]
- Upload **GPX, KML, or GeoJSON**; multiple uploads and mixed overlays are supported. Support says the map can automatically resize/reposition to fit uploaded data that extends outside the original segment.[16][17]
- Direct **Komoot** workflow: authenticate to a Komoot profile from the editor, allow access to saved tours, select one or multiple tours, re-open the Komoot picker to add newly saved tours, then restyle routes/add POIs. A print map can accompany a Komoot QR code/link/elevation profile in a brochure.[31]
- **Strava/Bikemap/other GPS-service workflow:** export/download a recorded GPX/KML/GeoJSON route, upload it, style it, and use the high-resolution map for wall art, event materials, hiking/cycling maps, or posters.[32][34]

### C. POIs, labels, spreadsheet/batch geocoding

- Add a single POI by dragging it, searching/entering its location, or providing coordinates; customize marker size, outer/inner shape, colors, icon, and label.[3][4]
- Built-in icon choices are documented, and a label can be shown without a visible pin by making its shapes transparent.[4]
- Upload a custom logo/marker as **PNG, SVG, JPG, or GIF**. Minimum size is **100 px on the shortest side**; larger is recommended because it can be scaled down.[10]
- “Multiple POIs (Spreadsheet)” accepts pasted data from Excel or Google Sheets. The minimum lookup data is either **longitude + latitude** or **postcode/city + country**. Optional names become POI and layer names; a “Found?” column previews geocoder matches before Apply.[27]
- Batch-geocoded markers can be reviewed, restyled, resized, and, in layered outputs, fine-tuned individually later. The real-estate workflow additionally documents selecting POIs from Printmaps’ own POI database (e.g., schools, doctors, pharmacies, parks, bus stops, groceries).[33]

### D. Geographic shapes and content-layer workflow

- Query administrative shapes from the database and add multiple countries, regions/states, municipalities, cities/districts. Set fill/stroke, any standard color or explicit **HEX/RGB**, transparency/opacity, and optionally invert the shape to dim everything outside it.[3][20]
- A border-emphasis recipe is documented: put a stroked copy of the shape below a non-stroked copy. Each shape is a separate layer in layered outputs. Whole-continent selection is explicitly not supported “yet.”[3][20]
- The in-editor layer list can reorder layers, highlight a layer on hover, and remove, hide, edit, or replace layers. Public pages mention labels, routes, shapes, hillshading, roads, buildings, and each POI as separately named layers in PSD/SVG.[3]
- Mixed shapes, files, POIs, and multiple routes are allowed, and Support mentions an Undo action.[16]
- The first-party AI-information page lists a **walking-time isochrone** among content tools, but no public support article or parameter detail was found for this self-service feature.[8]

## 3. Output formats, delivery, and practical limits

| Output | Documented properties | Maximum editor print size | Key caveat |
|---|---|---:|---|
| PNG | Flat/simple raster, **300 dpi**, no layers | **220 × 220 mm** | Intended for simple print/web use; can still be edited externally as a flat image.[3][8] |
| PSD | Photoshop document, **300 dpi**, named/editable layers for map and added content | **660 × 660 mm** | Public pages say it works in Photoshop and also mention Illustrator compatibility.[8][15] |
| SVG | Layered vector, scalable resolution; searchable/scriptable/compressible XML | Editor supports **1,330 × 1,330 mm**, with larger physical printing possible by vector scaling | Unavailable after map tilt/rotation.[3][8] |

Additional output/workflow facts:

- Preview tab provides a **72 dpi** preview containing edits, routes, and POIs, usable as a placeholder before purchase; the same article links downloadable PSD/PNG/SVG samples.[14]
- Server generation occurs after ordering and Support says to allow **up to 10 minutes**, depending on map complexity, before an email download link arrives. Terms say contact support if invoice/download links have not arrived within **20 minutes**; weekday support hours are 09:00–17:00 CET.[9][23]
- The order email includes a VAT PDF invoice, and map files arrive via links in a later email. Downloads are compressed ZIPs; links remain available for at least **7 days** and permit single or multiple download.[9]
- Save/Open supports returning to a map or sharing it. Every map purchase also emails a permalink that reopens the editor with that map’s settings/data, enabling a new derivative map.[13]
- Maps and added content remain individually named layers in PSD/SVG, enabling recoloring, hiding, moving, deleting, or replacing items without altering content beneath.[3][15]
- Fonts: **Noto Sans regular/bold** and **Sorts Mill Goudy Italic**, under the Open Font License. Support offers common Photoshop label settings (40 px, tracking 75, Crisp antialiasing, 4 px white stroke, 80% opacity).[4]
- Hillshading inside SVG is intentionally raster, documented as 72 dpi. If it appears blocky in Illustrator, Support recommends bicubic interpolation instead of Nearest Neighbor; Inkscape reportedly uses bicubic by default.[4]
- Practical complexity guidance conflicts with “upload as many as you like” marketing: the AI-information FAQ says the print server can **generally handle up to 300 POIs or 100 routes total**.[8]

## 4. Pricing, licences, billing, and support workflows

### Public per-map table observed

The pricing page dynamically localizes country/VAT. On the research environment it displayed “Iran,” so the table below is the **observed euro table**, not a claim about final tax-inclusive prices in every country. Checkout determines final country/tax.[6]

| Licence / circulation | Layered SVG | Layered PSD 300 dpi | Simple PNG 300 dpi |
|---|---:|---:|---:|
| Mini — up to **1,000** copies | €59/map | €25/map | €6/map |
| Standard — up to **35,000** copies | €199/map | €79/map | €33/map |
| Unlimited — unlimited circulation | €749/map | €299/map | €119/map |

- All three tiers advertise all features and full commercial/non-commercial usage rights, including transfer to a customer, subject to attribution and the full Terms. Pricing depends on both output format and permitted circulation.[6][8]
- The page states there is a **free option for web use**, but no public page examined specifies its exact dimensions, resolution, watermark/attribution, or volume limit. The documented 72 dpi preview is a separate, clearly described preview workflow; equivalence to the free-web option is **not established**.[6][14]
- No subscription is required for ordinary per-map purchases. Volume discounts, customizable yearly flat fees/map packages, per-publication plans, and subscription options are available by request; checkout can add another map.[8][21][4]
- Publicly listed payment methods: major credit cards, PayPal, Apple Pay, Google Pay, Venmo, and bank transfer in selected countries. Support’s shorter article explicitly names Visa, Mastercard, Amex, PayPal, and country-dependent bank transfer.[6][24]
- VAT: EU customers are charged the digital-product tax rate of their country; non-EU customers do not pay VAT; a valid VAT ID enables reverse charge for cross-border EU business sales, except Austrian customers.[22]
- Proper invoice is emailed immediately after ordering. A **30-day money-back guarantee** applies, but refund/reversal terminates the licence and requires deletion/destruction of files, exports, adaptations, derivatives, and transferred copies.[9]

### Legal rights and attribution

- Purchase grants a **non-exclusive** right to use the map up to the selected circulation. Commercial use, later adaptation, downsized website use, and transfer of usage rights to a third party/client are permitted. **Resale and sublicensing are excluded** unless a separate reseller arrangement is obtained.[9]
- Required visible credit: **“© Printmaps.net / OSM Contributors”**, legible and near the map. Online, “Printmaps.net” and “OSM Contributors” must link to `https://www.printmaps.net/` and `https://www.openstreetmap.org/copyright` respectively.[9][25]
- Digital presentations should use the licence matching audience size; TV/DVD/video requires Unlimited and legible credits in end titles or equivalent.[9]
- The terms disclaim data currentness/correctness and point to the pre-purchase preview for inspection.[9]

## 5. Public Printmaps API and linked Static Maps API

### Printmaps API (documented current product page)

- Intended to add automated, high-resolution printable maps to an application. It inherits all features of Maptoolkit’s Static Maps API, adds **300 dpi (@4x)** or **150 dpi (@2x)**, and returns **PNG, JPEG, or WebP**.[39]
- Supports customer map styles and geodata, configuration and batch processing personalized per recipient, and automated projects such as mailings, photobooks, travel reports, and promotional material.[39]
- FAQ says custom markers/labels/overlays can be supplied as geodata via **KML or GeoJSON**. A free tier is available through RapidAPI.[39]
- The same page distinguishes this API from manual/non-automated Printmaps.net self-service and links a separate white-label editor integration option.[39][26]

### Inherited Static Maps API surface

The Printmaps page explicitly says it supports all Static Maps API features. Current Static Maps marketing documents URL-based integration, PNG/JPEG/WebP, web/Retina resolution, six cartographic languages, custom markers/overlays, and Enterprise-only custom styles, CDN storage, and PDF usage.[40]

The linked documentation currently redirects to a URL containing `doc__trashed`; treat it as a live but possibly legacy document. It documents:

- URL endpoint `https://maptoolkit.p.rapidapi.com/staticmap?parameters`, API-key authentication, first-call rendering with file-level caching.[41]
- Location by `center=lat,lng` + `zoom` (**1–17**) or by `bounds=north,east,south,west`; optional `delta_zoom`.[41]
- `size=widthxheight`, output `format=jpeg|png|webp` (PNG default), `maptype=terrain|terrainwinter|light` (terrain default), and `factor=2` for Retina.[41]
- Repeatable markers with custom PNG icon URL, center/bottom anchor, coordinates, and configurable z-order (`viewport` default or `source`).[41]
- Repeatable paths with pixel weight (default 3), 32-bit hex color, and coordinate vertices.[41]
- GeoJSON overlays support **LineString** and **MultiLineString** with width and RGBA color.[41]
- One KML URL may be supplied; polylines and polygons are extracted and rendered.[41]

### API pricing/limits: documented but attribution is ambiguous

The Printmaps API links Maptoolkit’s general pricing page. That page currently shows Basic free (120,000 map requests + 500 API requests, hard limits), Pro $19/month (600,000 map + 40,000 API), Ultra $349/month (12,000,000 map + 1,000,000 API), and Enterprise €420+/month (unlimited, Enterprise APIs, demos/templates). Overage text says $0.02/1,000 map and $0.3/1,000 API requests, though its FAQ contains a contradictory per-request decimal for API usage.[42] **Gap:** the public table does not explicitly say which bucket a high-resolution Printmaps render consumes, so these should not be quoted as Printmaps-specific quotas without sales confirmation.

## 6. Secondary public products and partnership capabilities

### Free Elevation Profile Maker

- Browser tool requiring no software, account, or login. Input: GPX/KML/GeoJSON upload, road-snapping magnet route, or freehand route.[28]
- Outputs **PDF, layered SVG, and PNG**. The page initially highlights SVG but its FAQ confirms all three formats.[28]
- Reported results include altitude difference, distance, walking time, normal cycling time, off-road cycling time, and race-cycling time.[28]
- Controls: print width **50–300 mm**, stroke vs gradient curve, gradient/stroke color, font size **20–70**, elevation markers and marker color, horizontal/vertical grid, metric (m/km) or imperial (ft/mi) units.[28]
- Free for print/online use with nearby **© Printmaps.net** credit and online link. It says static use or interactive SVG use needs no cookie-banner entry.[28]

### Free WordPress “Static Maps Editor” plugin

- Creates non-interactive maps inside the WordPress back end using Printmaps-hosted editor functionality; supports styles, routes, POIs/pins, geo-shapes/highlighted areas, elevation, design personalization, tilt, and rotation.[30]
- Output PNGs are saved to the WordPress Media Library and hosted locally in the site’s upload folder. The page claims compatibility with image-handling plugins and “100% GDPR compliant.”[30]
- Terms: plugin PHP is GPL, but images/logotypes/external services and the proprietary editor are protected; copyright links may not be removed. Plugin may be used as-is to create and display static images, but the editor may not be modified, redistributed, embedded, displayed, or distributed by another method.[9]

### Non-profit, enterprise, and channel features

- Selected charities/non-profits can apply via support for a free printable map with Unlimited circulation (page says value around €350). Requires recognized charitable status and excludes political/legislative, religious/evangelical, public-opinion influence, private foundations, and discriminatory organizations; application asks for legal name, location, website, and proposed print product.[29]
- White-label editor integration, API access, reseller/extended licensing, subscription/flat-fee plans, and an affiliate revenue-share program are available by inquiry.[3][4][26]
- A public print-design-agency directory helps users find experienced Printmaps designers/desktop publishers by country: `https://www.printmaps.net/print-design-agencies/`.

## 7. Specialized public use-case/workflow pages

- **Route maps:** magnet-to-road or freehand routes, mixed travel modes, uploaded GPX/KML/GeoJSON, batch-geocoded stops, layered download, free elevation-profile companion. `https://www.printmaps.net/route-map-maker/`[34]
- **Komoot:** direct Komoot account/tour import, one or multiple tours, restyling, QR/link workflow. `https://www.printmaps.net/print-komoot-tours/`[31]
- **Strava / GPS wall art:** export recorded route then upload, style, and print as framed/canvas map. `https://www.printmaps.net/strava-route-prints/`[32]
- **Real estate:** property marker, database POIs (schools/transit/parks/etc.), neighborhood and directions maps, batch property addresses, layered post-processing. `https://www.printmaps.net/real-estate-flyers/`[33]
- **Architecture/site analysis:** filter base elements, add shapes/routes/POIs, export layered PSD/SVG or PNG; cited applications include access, buildings, land use/topography/hydrology/vegetation/utilities/constraints. `https://www.printmaps.net/site-analysis-map/`[35]
- **Graphic designers/vector maps:** layered SVG/PSD intended for Illustrator, InDesign, Photoshop, or Figma; use cases include magazines, posters, infographics, and marketing. `https://www.printmaps.net/vector-map-maker/`[36]
- **Custom cartography:** preset-to-custom workflow positioned as minutes rather than a traditional commissioned-cartography cycle; commercial use and post-purchase support/refund. `https://www.printmaps.net/custom-cartography/`[37]
- **Tourist guides:** POI symbols, road/place-name emphasis, optional topography for hiking, batch geocoding, shapes, routes, GPS upload, multi-language Save/Open workflow. `https://www.printmaps.net/creating-maps-for-tourist-guides/`
- **Map posters:** preset/custom print size, routes/pins/shapes, minimalist layer/label hiding; suggested PSD/SVG for >220 mm. `https://www.printmaps.net/create-a-map-poster/`
- **Photobooks/travel maps:** inverted country shapes, transparency, numbered/custom POIs, road-following itinerary, combine overview + close-up maps. `https://www.printmaps.net/travel-map-photobook/`
- **Road trips:** route/stops/POIs, branding colors, travel-mode display, keepsake/poster/photobook outputs. `https://www.printmaps.net/road-trip-map/`
- **Multiple locations/bulk geocoding:** copy addresses from spreadsheet/database, convert to coordinates, restyle custom-logo markers, add shapes/routes. `https://www.printmaps.net/print-map-with-multiple-locations/`
- **Map with pins:** addresses or decimal coordinates, spreadsheet import, transparent-label-only markers, imported GPX/KML/GeoJSON pins/shapes/routes. `https://www.printmaps.net/create-map-with-pins/`

## 8. Support, privacy, and public-service surface

- Support portal exposes a searchable English knowledge base and ticket submission; categories are Technical, Map Design, Payment & Pricing, Legal & Usage, Enterprise & Resellers, and Miscellaneous.[7]
- The privacy page documents order/contact/account data, Stripe/PayPal payment processing, Quaderno invoicing, Mailchimp newsletter, Trustpilot review invitations, anonymized server logs, cookies, Google Analytics/Ads, and correction/deletion/contact rights. Its footer date is 2019, making its recency questionable.[38]

## 9. Important gaps, conflicts, and interpretation warnings

1. **Current size conflict:** detailed current pages say PNG 220 mm, PSD 660 mm, SVG 1,330 mm; the Features summary table says “Maps up to 660 mm,” and an older glossary says 600 mm/200 mm. Use the detailed format FAQ/pricing table as the stronger current source.[3][8]
2. **Route/POI quantity conflict:** multiple pages say “as many as you like/can fit,” while the AI-information FAQ says the print server generally handles 300 POIs or 100 routes. Treat those as practical capacity, not a guaranteed hard quota.[8]
3. **Free web option undefined:** repeatedly advertised but no public dimensions/resolution/licence/watermark limits were found. Do not assume it equals the 72 dpi preview.[6][14]
4. **API docs may be legacy:** `/doc/static-maps/` redirects to `/doc__trashed/static-maps/`; map types and parameter surface may therefore lag the marketed API. The Printmaps API landing page is newer and should control where it conflicts.[39][41]
5. **API pricing ambiguity:** Maptoolkit’s general table is linked, but it does not explain whether a 150/300-dpi Printmaps render counts as “map” or “API,” nor any high-res size ceiling.[42]
6. **Walking-time isochrone under-documented:** listed as a core content tool on the AI-information page, but no public workflow/limits were found.[8]
7. **No public self-service PDF/TIFF/AI export:** verified core outputs are PNG/PSD/SVG. PDF belongs to the elevation-profile tool; PNG/JPEG/WebP belong to the Printmaps API.[8][28][39]
8. **No direct editor verification:** all capability statements above are documented/observed on public non-editor pages. UI availability, performance, and exact current labels were not independently tested.

## 10. English Knowledge Base URL map (all public articles found)

Base index: `https://support.printmaps.net/en/support/solutions`.[7]

- Coverage/data: `https://support.printmaps.net/en/support/solutions/articles/204000000239-does-printmaps-net-work-worldwide-`; `https://support.printmaps.net/en/support/solutions/articles/204000000241-what-map-projection-do-you-use-`; `https://support.printmaps.net/en/support/solutions/articles/204000000242-how-often-do-you-update-the-map-data-`; `https://support.printmaps.net/en/support/solutions/articles/204000000243-something-is-wrong-in-your-maps-what-can-i-do-`.
- Output/workflow: `https://support.printmaps.net/en/support/solutions/articles/204000000244-do-i-need-300-dpi-or-600-dpi-for-my-print-project-`; `https://support.printmaps.net/en/support/solutions/articles/204000000245-i-need-a-map-bigger-than-133x133-centimeters-what-can-i-do-`; `https://support.printmaps.net/en/support/solutions/articles/204000000246-can-i-save-a-map-i-created-for-later-`; `https://support.printmaps.net/en/support/solutions/articles/204000000247-can-i-get-a-sample-map-`; `https://support.printmaps.net/en/support/solutions/articles/204000000248-what-file-formats-will-i-get-the-map-in-`; `https://support.printmaps.net/en/support/solutions/articles/204000000265-how-long-do-i-have-to-wait-for-a-map-`.
- Design/content: `https://support.printmaps.net/en/support/solutions/articles/204000000240-can-i-use-custom-markers-or-logos-`; `https://support.printmaps.net/en/support/solutions/articles/204000000249-what-fonts-are-used-in-the-maps-`; `https://support.printmaps.net/en/support/solutions/articles/204000000251-can-i-add-multiple-routes-or-shapes-to-one-map-can-i-combine-different-types-of-overlay-content-`; `https://support.printmaps.net/en/support/solutions/articles/204000000252-can-i-upload-other-data-onto-the-map-`; `https://support.printmaps.net/en/support/solutions/articles/204000000253-can-i-display-a-list-of-pois-on-the-map-`; `https://support.printmaps.net/en/support/solutions/articles/204000000254-can-i-add-a-route-to-the-map-`; `https://support.printmaps.net/en/support/solutions/articles/204000000255-how-can-i-control-font-sizes-`; `https://support.printmaps.net/en/support/solutions/articles/204000000256-how-can-i-change-the-map-design-`; `https://support.printmaps.net/en/support/solutions/articles/204000000258-can-i-highlight-a-country-city-or-region-on-the-map-`; `https://support.printmaps.net/en/support/solutions/articles/204000000550-can-i-add-pins-to-the-map-if-i-don-t-know-their-location-`; `https://support.printmaps.net/en/support/solutions/articles/204000000551-i-have-an-excel-list-of-addresses-can-i-convert-it-to-points-on-the-map-`; `https://support.printmaps.net/en/support/solutions/articles/204000000591-how-do-i-create-maps-for-real-estate-expos%C3%A9s-`; `https://support.printmaps.net/en/support/solutions/articles/204000026833-hillshading-looks-pixelated-when-i-open-an-svg-in-illustrator-what-can-i-do-about-that-`; `https://support.printmaps.net/en/support/solutions/articles/204000038496-how-do-i-add-city-names-that-are-not-shown-at-my-desired-zoom-level-`.
- Price/billing: `https://support.printmaps.net/en/support/solutions/articles/204000000261-are-there-volume-discounts-if-i-need-many-maps-`; `https://support.printmaps.net/en/support/solutions/articles/204000000262-can-i-buy-multiple-maps-at-once-`; `https://support.printmaps.net/en/support/solutions/articles/204000000263-do-i-have-to-pay-vat-`; `https://support.printmaps.net/en/support/solutions/articles/204000000264-will-i-get-a-proper-invoice-`; `https://support.printmaps.net/en/support/solutions/articles/204000000266-how-can-i-pay-`; `https://support.printmaps.net/en/support/solutions/articles/204000000268-how-much-does-a-map-cost-`; `https://support.printmaps.net/en/support/solutions/articles/204000000658-how-does-the-30-day-money-back-guarantee-work-`.
- Legal: `https://support.printmaps.net/en/support/solutions/articles/204000000269-may-i-use-a-map-i-bought-on-my-website-`; `https://support.printmaps.net/en/support/solutions/articles/204000000271-can-i-transfer-usage-rights-to-a-customer-of-mine-`; `https://support.printmaps.net/en/support/solutions/articles/204000000272-how-do-i-have-to-credit-attribute-the-map-`; `https://support.printmaps.net/en/support/solutions/articles/204000000274-may-i-adapt-or-change-the-map-`; `https://support.printmaps.net/en/support/solutions/articles/204000000275-how-often-am-i-allowed-to-print-a-map-`.
- Enterprise/misc: `https://support.printmaps.net/en/support/solutions/articles/204000000280-can-printmaps-produce-interactive-digital-maps-not-just-printable-ones-`; `https://support.printmaps.net/en/support/solutions/articles/204000000281-do-you-have-special-offers-for-publishers-or-bulk-users-`; `https://support.printmaps.net/en/support/solutions/articles/204000000282-i-want-to-link-to-printmaps-net-do-you-offer-revenue-share-`; `https://support.printmaps.net/en/support/solutions/articles/204000000283-can-i-integrate-the-printmaps-net-editor-into-my-application-`; `https://support.printmaps.net/en/support/solutions/articles/204000000284-openstreetmap-is-freely-available-why-isn-t-printmaps-net-free-`; `https://support.printmaps.net/en/support/solutions/articles/204000000669-who-is-behind-printmaps-net-`.

## Sources

[3] https://www.printmaps.net/features — Printmaps features
[4] https://support.printmaps.net/en/support/home — Printmaps knowledge base
[6] https://www.printmaps.net/pricing
[7] https://support.printmaps.net/en/support/solutions
[8] https://www.printmaps.net/information-for-ai
[9] https://www.printmaps.net/terms-of-use
[10] https://support.printmaps.net/en/support/solutions/articles/204000000240-can-i-use-custom-markers-or-logos-
[11] https://support.printmaps.net/en/support/solutions/articles/204000000241-what-map-projection-do-you-use-
[12] https://support.printmaps.net/en/support/solutions/articles/204000000242-how-often-do-you-update-the-map-data-
[13] https://support.printmaps.net/en/support/solutions/articles/204000000246-can-i-save-a-map-i-created-for-later-
[14] https://support.printmaps.net/en/support/solutions/articles/204000000247-can-i-get-a-sample-map-
[15] https://support.printmaps.net/en/support/solutions/articles/204000000248-what-file-formats-will-i-get-the-map-in-
[16] https://support.printmaps.net/en/support/solutions/articles/204000000251-can-i-add-multiple-routes-or-shapes-to-one-map-can-i-combine-different-types-of-overlay-content-
[17] https://support.printmaps.net/en/support/solutions/articles/204000000252-can-i-upload-other-data-onto-the-map-
[18] https://support.printmaps.net/en/support/solutions/articles/204000000254-can-i-add-a-route-to-the-map-
[19] https://support.printmaps.net/en/support/solutions/articles/204000000256-how-can-i-change-the-map-design-
[20] https://support.printmaps.net/en/support/solutions/articles/204000000258-can-i-highlight-a-country-city-or-region-on-the-map-
[21] https://support.printmaps.net/en/support/solutions/articles/204000000261-are-there-volume-discounts-if-i-need-many-maps-
[22] https://support.printmaps.net/en/support/solutions/articles/204000000263-do-i-have-to-pay-vat-
[23] https://support.printmaps.net/en/support/solutions/articles/204000000265-how-long-do-i-have-to-wait-for-a-map-
[24] https://support.printmaps.net/en/support/solutions/articles/204000000266-how-can-i-pay-
[25] https://support.printmaps.net/en/support/solutions/articles/204000000272-how-do-i-have-to-credit-attribute-the-map-
[26] https://support.printmaps.net/en/support/solutions/articles/204000000283-can-i-integrate-the-printmaps-net-editor-into-my-application-
[27] https://support.printmaps.net/en/support/solutions/articles/204000000551-i-have-an-excel-list-of-addresses-can-i-convert-it-to-points-on-the-map-
[28] https://www.printmaps.net/elevation-profile-editor
[29] https://www.printmaps.net/free-printable-maps
[30] https://www.printmaps.net/wordpress-plugin-static-maps-editor
[31] https://www.printmaps.net/print-komoot-tours
[32] https://www.printmaps.net/strava-route-prints
[33] https://www.printmaps.net/real-estate-flyers
[34] https://www.printmaps.net/route-map-maker
[35] https://www.printmaps.net/site-analysis-map
[36] https://www.printmaps.net/vector-map-maker
[37] https://www.printmaps.net/custom-cartography
[38] https://www.printmaps.net/data-protection-policy
[39] https://www.maptoolkit.com/api/printmaps-api
[40] https://www.maptoolkit.com/api/static-maps-api
[41] https://www.maptoolkit.com/doc__trashed/static-maps
[42] https://www.maptoolkit.com/pricing
