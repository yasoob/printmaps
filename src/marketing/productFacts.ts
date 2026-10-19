/**
 * Plain product facts shared by /product-facts/ and /llms-full.txt. Every number here is
 * taken from the editor source (page presets, import limits, video and relief settings);
 * update it together with the code it describes.
 */
export const productFactSections = [
  {
    id: 'basics',
    heading: 'Basics',
    facts: [
      'Print Map Studio is a free, browser-based editor for print-ready maps and map posters.',
      'It needs no account and adds no watermark. The only text added to an export is the map data credit in the page margin.',
      'It runs in current desktop and mobile browsers with JavaScript and WebGL.',
      'It is created and maintained by Yasoob Khalid. The source code and issue tracker are public on GitHub.',
    ],
  },
  {
    id: 'pages',
    heading: 'Page sizes',
    facts: [
      'Presets: A2 (420 × 594 mm), A3 (297 × 420 mm), A4 (210 × 297 mm), A5 (148 × 210 mm), A6 (105 × 148 mm) and US Letter (215.9 × 279.4 mm).',
      'Any custom width and height in millimetres, in portrait or landscape.',
      'The editor shows the print frame at the chosen size while you compose.',
    ],
  },
  {
    id: 'styles',
    heading: 'Map styles and labels',
    facts: [
      '12 map styles: Paper, Graphite, Porcelain, Sandstone, Night Ink, Blueprint, Sea Glass, Rosewater, Alpine, Coastal, Terracotta and Signal.',
      'A palette editor adjusts tone, contrast and detail, plus individual colours for land, water, parks, buildings, roads, boundaries, transit and labels.',
      'Labels can show local names, English, German, French, Italian, Spanish or Chinese, at 50% to 200% text scale.',
      'Roads, buildings, labels, water, parks, land detail and transit can each be shown or hidden.',
    ],
  },
  {
    id: 'content',
    heading: 'Routes, places and areas',
    facts: [
      'Routes can be straight, arcs or road-following, with travel markers along the line.',
      'A route elevation profile downloads separately as SVG, PNG or PDF, 50 to 300 mm wide.',
      'Places can be added one by one or from a spreadsheet of up to 300 coordinate rows or 25 addresses.',
      'Place markers can use a custom PNG, JPEG or SVG image.',
      'Areas can be drawn by hand, picked from a catalogue of countries and first-level regions, or generated as travel-time areas for walking, cycling or driving from 5 to 60 minutes.',
      'GPX, KML and GeoJSON files up to 5 MB import as editable layers. A project holds up to 1,000 layers and 200,000 coordinates.',
    ],
  },
  {
    id: 'poster',
    heading: 'Poster layout',
    facts: [
      'Layout presets: City edition, Quiet lines, After dark, Land & outline and Field notes.',
      'Ready-made example projects for Lisbon, Kyoto, New York and Copenhagen.',
      'Title, subtitle, caption and coordinates (decimal or degrees-minutes-seconds), with page margins and paper colour.',
      'The map can be clipped to the outline of a country or region.',
      'PNG or JPEG photos pin to places and appear as round or square badges on the map or in a numbered strip with captions, up to 24 photo stops.',
      'Map furniture: a compass (arrow or rose), a metric or imperial scale bar, a labelled coordinate grid, and a QR code that opens the map centre or a chosen place in Google Maps.',
      '3D terrain with adjustable exaggeration, and contour lines with a chosen interval and colour.',
      'Wall preview shows the poster on a wall in a black, white, oak or walnut frame, with an optional mat.',
    ],
  },
  {
    id: 'export',
    heading: 'Exports',
    facts: [
      'PNG at 300 dpi for the selected page size, for example about 4961 × 3508 pixels for A3.',
      'PDF at the exact page size, with routes, places and shapes as vector content.',
      'Layered SVG with routes, places and shapes as named vector groups over the basemap.',
      'Layered PSD with each content layer and the attribution as separate SVG Smart Objects for Photoshop.',
      'MP4 map video with an Orbit or Sway motion, 5, 10 or 15 seconds, 30 or 60 fps, in the page shape or 16:9, 9:16, 1:1 or 4:5, up to 1920 pixels on the long edge. Recording uses the browser MP4 recorder in Chrome, Edge and Safari.',
      'STL terrain relief for 3D printing, sized in millimetres to match the print frame, with low, medium or high detail and an optional raised route ridge.',
      'A portable project file that reopens the full design later.',
      'All exports are generated in the browser and download directly.',
    ],
  },
  {
    id: 'sharing',
    heading: 'Sharing',
    facts: [
      'Read-only share links and iframe embed code with a chosen height.',
      'The design is compressed into the link itself, so sharing needs no upload.',
      'Shared maps and embeds keep the map attribution.',
    ],
  },
  {
    id: 'data',
    heading: 'Data sources and privacy',
    facts: [
      'Basemaps use OpenFreeMap tiles with OpenMapTiles data from OpenStreetMap contributors.',
      'Terrain uses AWS Terrain Tiles (Mapzen) with data from USGS, SRTM and other sources. Elevation profiles use the Open-Meteo elevation API.',
      'Place search, road routing, map matching and travel-time areas use Mapbox.',
      'Projects autosave in browser storage on the device. Imported files and exports stay on the device.',
    ],
  },
] as const;
