export const SITE_NAME = 'Print Map Studio';
export const SITE_URL = 'https://printmaps.yasoob.me';

export const navigation = [
  { href: '/#features', label: 'Features' },
  { href: '/#use-cases', label: 'Use cases' },
  { href: '/#faq', label: 'FAQ' },
] as const;

export const faqItems = [
  {
    question: 'What is Print Map Studio?',
    answer: 'Print Map Studio is a free browser-based design tool for creating static, print-ready maps. It combines page sizing, map styles, routes, places, shapes, imported geographic data and high-resolution export in one visual workspace.',
  },
  {
    question: 'How do I design a map?',
    answer: 'Choose the page size and orientation, move the map to the place you need, select a visual style, then add routes, places or areas. You can preview the composition and export it when the map is ready.',
  },
  {
    question: 'Is Print Map Studio free?',
    answer: 'Yes. You can open the editor and create a map without paying or creating an account.',
  },
  {
    question: 'Do I need to create an account?',
    answer: 'No. Print Map Studio runs in your browser and does not require a sign-up before you start designing.',
  },
  {
    question: 'Where are my map projects stored?',
    answer: 'Your current project autosaves in browser storage. You can also download a portable project file and open it again later. Clearing browser data can remove the local autosave, so download important projects as a backup.',
  },
  {
    question: 'Can I choose a custom print size?',
    answer: 'Yes. Start from a standard page preset or enter a custom width and height in millimetres, then switch between landscape and portrait orientation.',
  },
  {
    question: 'Which map data files can I import?',
    answer: 'You can import GPX, KML and GeoJSON files. Imported routes, points and shapes become editable content layers in the project.',
  },
  {
    question: 'Can I draw routes and add places?',
    answer: 'Yes. Draw routes directly, create road-following directions when provider services are configured, add individual or spreadsheet-based places, and style each layer independently.',
  },
  {
    question: 'Can I add many places at once?',
    answer: 'Yes. Paste a list of names with coordinates into the place spreadsheet. Address-based rows can also be looked up when provider-backed search is configured.',
  },
  {
    question: 'Can I upload a custom marker or logo?',
    answer: 'Yes. A place marker can use your own PNG, JPEG or SVG image. Custom markers are stored inside the portable project and supported by the live map, PNG, layered SVG and layered PSD workflows; PDF does not currently support them.',
  },
  {
    question: 'Can I highlight a country or region?',
    answer: 'Yes. The editor includes a global catalogue of countries and first-level administrative regions. You can add boundaries as styled shape layers alongside custom GeoJSON shapes.',
  },
  {
    question: 'Can I change map labels and language?',
    answer: 'Yes. Adjust text scale, show or hide labels and other map details, and choose local names, English, German, French, Italian, Spanish or Chinese.',
  },
  {
    question: 'Does search and road routing always work?',
    answer: 'The core editor and map rendering work without an account. Place search, road routing, map matching and travel-time areas depend on the site having a browser-safe Mapbox public token configured.',
  },
  {
    question: 'Which export formats are available?',
    answer: 'Print Map Studio exports print-sized PNG, PDF, layered SVG and layered PSD files. PDF and SVG keep supported routes, places and shapes as vector content. PSD embeds each content layer and attribution as a separate SVG Smart Object over a raster basemap.',
  },
  {
    question: 'Can I make a high-resolution map for print?',
    answer: 'Yes. PNG export targets the selected physical page size at print resolution, and PDF preserves the exact page dimensions. Very large exports are checked before rendering so the browser can warn about memory-heavy jobs.',
  },
  {
    question: 'Can I edit the map after export?',
    answer: 'Choose layered SVG for named vector groups or layered PSD for separately named SVG Smart Objects in Photoshop. PNG is a flat image, while PDF preserves the exact page and supported vector overlays.',
  },
  {
    question: 'How do I receive my exported files?',
    answer: 'Exports are created in your browser and downloaded immediately. There is no order queue or email delivery step.',
  },
  {
    question: 'Does Print Map Studio print or ship maps?',
    answer: 'No. Print Map Studio creates digital map files. You can place them in a layout, share them digitally or send them to the printer of your choice.',
  },
  {
    question: 'What map data does Print Map Studio use?',
    answer: 'The standard map styles use OpenFreeMap and OpenMapTiles data derived from OpenStreetMap. Required attribution is kept with the map and its exports.',
  },
  {
    question: 'Does Print Map Studio create interactive web maps?',
    answer: 'No. It is designed for static maps used in print and image-based digital layouts, not embedded interactive maps or turn-by-turn navigation.',
  },
] as const;

export function breadcrumbStructuredData(items: readonly { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
