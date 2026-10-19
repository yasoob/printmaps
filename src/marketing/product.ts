export const SITE_NAME = 'Print Map Studio';
export const SITE_URL = 'https://printmaps.yasoob.me';
export const CREATOR_NAME = 'Yasoob Khalid';
export const CREATOR_URL = 'https://yasoob.me';
export const GITHUB_URL = 'https://github.com/yasoob/printmaps';

export const navigation = [
  { href: '/#features', label: 'Features' },
  { href: '/#use-cases', label: 'Use cases' },
  { href: '/#faq', label: 'FAQ' },
] as const;

export const faqItems = [
  {
    question: 'What is Print Map Studio?',
    answer: 'Print Map Studio is a free browser-based editor for print-ready maps and map posters. Pick a place, set the page size, choose a style, add routes, places, photos or shapes, and export the finished map.',
  },
  {
    question: 'How do I design a map?',
    answer: 'Choose the page size and orientation, move the map to the place you need, select a visual style, then add routes, places or areas. Turn on a poster layout for a title and caption, check the composition on the page, and export when it looks right.',
  },
  {
    question: 'Is Print Map Studio free?',
    answer: 'Yes. Every feature and every export format is free, and exports carry no watermark. The only text added to the page is the small map data credit that OpenStreetMap requires.',
  },
  {
    question: 'Do I need to create an account?',
    answer: 'No. Open the editor and start designing. Print Map Studio runs in your browser.',
  },
  {
    question: 'Where are my map projects stored?',
    answer: 'Your current project autosaves in browser storage on your device. Download a portable project file to keep a backup or to continue on another computer.',
  },
  {
    question: 'Can I choose a custom print size?',
    answer: 'Yes. Start from A2, A3, A4, A5, A6 or US Letter, or enter a custom width and height in millimetres, then switch between landscape and portrait.',
  },
  {
    question: 'Which map data files can I import?',
    answer: 'You can import GPX, KML and GeoJSON files. Imported routes, points and shapes become editable layers in the project.',
  },
  {
    question: 'Can I draw routes and add places?',
    answer: 'Yes. Draw routes as straight lines, arcs or road-following directions, add travel markers along them, and place single markers or a whole list of places. Each layer has its own style.',
  },
  {
    question: 'Can I add many places at once?',
    answer: 'Yes. Paste up to 300 rows with coordinates into the place spreadsheet, or up to 25 addresses that the editor looks up for you.',
  },
  {
    question: 'Can I upload a custom marker or logo?',
    answer: 'Yes. A place marker can use your own PNG, JPEG or SVG image. Custom markers are saved inside the project file and appear on the live map and in PNG, layered SVG and layered PSD exports.',
  },
  {
    question: 'Can I add photos to the map?',
    answer: 'Yes. Pin a photo to a place and show it as a round or square badge on the map, or in a numbered strip with captions along the top or bottom of the page. A poster can hold up to 24 photo stops.',
  },
  {
    question: 'Can I highlight a country or region?',
    answer: 'Yes. Pick any country or first-level region from the built-in catalogue and add it as a styled shape, or use its outline as the frame of the whole map.',
  },
  {
    question: 'Can I change map labels and language?',
    answer: 'Yes. Adjust text scale, show or hide labels and other map details, and choose local names, English, German, French, Italian, Spanish or Chinese.',
  },
  {
    question: 'Which online services does the editor use?',
    answer: 'Map tiles come from OpenFreeMap. Place search, road routing, map matching and travel-time areas use Mapbox, and elevation data comes from Open-Meteo. Everything else, including exports, runs in your browser.',
  },
  {
    question: 'Which export formats are available?',
    answer: 'Print Map Studio exports print-sized PNG, PDF, layered SVG and layered PSD files, plus MP4 map videos and STL terrain models. PDF and SVG keep routes, places and shapes as vector content. PSD puts each content layer in its own SVG Smart Object over the basemap.',
  },
  {
    question: 'Can I make a high-resolution map for print?',
    answer: 'Yes. PNG export renders the selected page size at 300 dpi, so an A3 page comes out at about 4961 by 3508 pixels. PDF keeps the exact page dimensions. The editor estimates memory use before very large exports.',
  },
  {
    question: 'Can I make a map video or a 3D print?',
    answer: 'Yes. Video export records an orbit or a gentle sway around your map for 5, 10 or 15 seconds at 30 or 60 fps, as MP4 in Chrome, Edge or Safari. STL export turns the terrain into a relief model for a 3D printer, with an optional raised route.',
  },
  {
    question: 'Can I edit the map after export?',
    answer: 'Choose layered SVG for named vector groups in Illustrator, Inkscape or Affinity, or layered PSD for separately named Smart Objects in Photoshop. PNG gives you a finished image and PDF an exact page.',
  },
  {
    question: 'How do I receive my exported files?',
    answer: 'Exports are created in your browser and download straight to your device.',
  },
  {
    question: 'Can I get my map printed?',
    answer: 'Yes. Download a PNG or PDF at the exact page size and send it to any print shop or online printing service. The [map print size guide](/map-print-size-guide/) lists pixel sizes for each paper size. Wall preview shows the poster in a black, white, oak or walnut frame first.',
  },
  {
    question: 'Can I share a map online?',
    answer: 'Yes. Create a read-only share link or copy an iframe embed code for your website, as described in [share and embed maps](/share-and-embed-maps/). The shared map keeps your design and the map attribution.',
  },
  {
    question: 'What map data does Print Map Studio use?',
    answer: 'The standard map styles use OpenFreeMap and OpenMapTiles data derived from OpenStreetMap. The required attribution is printed as a small credit in the page margin of every export.',
  },
] as const;
