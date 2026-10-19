/**
 * Marketing image registry. Pages reference screenshots and OG images only through
 * `media['<key>']` so files can be regenerated (scripts/capture-marketing-media.mts)
 * without touching page code.
 */
export type MarketingImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  mobileSrc?: string;
  mobileWidth?: number;
  mobileHeight?: number;
  /**
  Optional short muted loop; `src` is its poster frame.
  */
  video?: { src: string; type: 'video/mp4' | 'video/webm' };
};

const og = (title: string): MarketingImage => ({
  src: '/social-preview.png',
  width: 1200,
  height: 630,
  alt: `Print Map Studio: ${title}`,
});

export const media = {
  'hero.desktop': {
    src: '/hero-assets/editor-new-york.webp',
    width: 1600,
    height: 924,
    alt: 'Print Map Studio editor with a New York map poster on the page',
    mobileSrc: '/hero-assets/editor-mobile.webp',
    mobileWidth: 780,
    mobileHeight: 535,
  },
  'hero.mobile': {
    src: '/hero-assets/editor-mobile.webp',
    width: 780,
    height: 535,
    alt: 'Print Map Studio editor on a phone-sized screen',
  },
  'editor.map-tab': {
    src: '/feature-shots/design-desktop.webp',
    width: 1440,
    height: 900,
    alt: 'Map tab of the editor with the style picker and colour controls',
    mobileSrc: '/feature-shots/design-mobile.webp',
    mobileWidth: 780,
    mobileHeight: 844,
  },
  'editor.layout-tab': {
    src: '/explore-shots/printable-page-frame.webp',
    width: 915,
    height: 715,
    alt: 'Layout tab with page size, margins and poster title settings',
  },
  'editor.layer-route': {
    src: '/feature-shots/content-desktop.webp',
    width: 1440,
    height: 900,
    alt: 'A route selected as a map layer with its line style settings open',
    mobileSrc: '/feature-shots/content-mobile.webp',
    mobileWidth: 780,
    mobileHeight: 844,
  },
  'editor.export-print': {
    src: '/feature-shots/export-desktop.webp',
    width: 1440,
    height: 900,
    alt: 'Export dialog with PNG, PDF, layered SVG and layered PSD options',
    mobileSrc: '/feature-shots/export-mobile.webp',
    mobileWidth: 780,
    mobileHeight: 844,
  },
  'editor.export-video': {
    src: '/feature-shots/export-desktop.webp',
    width: 1440,
    height: 900,
    alt: 'Export dialog in the editor',
  },
  'editor.export-3d': {
    src: '/feature-shots/export-desktop.webp',
    width: 1440,
    height: 900,
    alt: 'Export dialog in the editor',
  },
  'editor.wall-preview': {
    src: '/explore-shots/gpx-print-frame.webp',
    width: 913,
    height: 715,
    alt: 'Map poster shown inside its printed page frame',
  },
  'editor.share': {
    src: '/explore-shots/export-project-download.webp',
    width: 860,
    height: 780,
    alt: 'Project download options in the editor',
  },
  'editor.templates': {
    src: '/explore-shots/printable-page-frame.webp',
    width: 915,
    height: 715,
    alt: 'A printable map poster layout in the editor',
  },
  'styles.grid': {
    src: '/explore-shots/custom-colors.webp',
    width: 1130,
    height: 1716,
    alt: 'Map style and colour settings in the editor',
  },
  'city.poster': {
    src: '/marketing/city/lisbon-city-map-poster.webp',
    width: 1600,
    height: 1200,
    alt: 'A3 Lisbon city map poster with the title block under the map',
  },
  'city.detail': {
    src: '/marketing/city/lisbon-poster-street-detail.webp',
    width: 1600,
    height: 1000,
    alt: 'Close-up of the Lisbon poster around Baixa and Alfama, with street names readable at print size',
  },
  'country.poster-filled': {
    src: '/explore-shots/printable-page-frame.webp',
    width: 915,
    height: 715,
    alt: 'A printable map poster in its page frame',
  },
  'country.frame-controls': {
    src: '/explore-shots/map-features.webp',
    width: 1130,
    height: 1716,
    alt: 'Map feature settings in the editor',
  },
  'wedding.poster': {
    src: '/marketing/wedding/edinburgh-wedding-map-poster.webp',
    width: 1600,
    height: 1200,
    alt: 'Edinburgh wedding map poster with two heart markers joined by a dashed arc',
  },
  'wedding.detail': {
    src: '/marketing/wedding/two-places-joined-by-an-arc.webp',
    width: 1600,
    height: 1000,
    alt: 'Detail of the wedding poster: a heart marker on Calton Hill at the end of a dashed arc',
  },
  'photos.poster': {
    src: '/marketing/photos/utah-road-trip-photo-map-poster.webp',
    width: 1600,
    height: 1200,
    alt: 'Southern Utah road trip poster with the driving route, photos pinned to four parks and a photo strip',
  },
  'photos.controls': {
    src: '/explore-shots/waypoint-style.webp',
    width: 1130,
    height: 1716,
    alt: 'Place settings in the editor',
  },
  'templates.gallery': {
    src: '/explore-shots/printable-page-frame.webp',
    width: 915,
    height: 715,
    alt: 'A printable map poster layout in the editor',
  },
  'templates.examples': {
    src: '/marketing/templates/lisbon-three-poster-layouts.webp',
    width: 1600,
    height: 1000,
    alt: 'The same Lisbon map in three layouts: City edition, Quiet lines and After dark',
  },
  'route.poster': {
    src: '/marketing/route/london-marathon-route-poster.webp',
    width: 1600,
    height: 1200,
    alt: 'Dark A3 marathon poster of a 42.3 km run along the Thames with start and finish markers',
  },
  'route.elevation': {
    src: '/explore-shots/route-advanced.webp',
    width: 1130,
    height: 1716,
    alt: 'Advanced route settings in the editor',
  },
  'topo.contours': {
    src: '/marketing/topo/matterhorn-contour-map.webp',
    width: 1600,
    height: 1200,
    alt: 'Topographic poster of Zermatt and the Matterhorn with contour lines every 50 metres',
  },
  'topo.terrain-3d': {
    src: '/hero-assets/editor-new-york.webp',
    width: 1600,
    height: 924,
    alt: 'Print Map Studio editor',
  },
  'stl.relief-preview': {
    src: '/feature-shots/export-desktop.webp',
    width: 1440,
    height: 900,
    alt: 'Export dialog in the editor',
  },
  'stl.export-dialog': {
    src: '/feature-shots/export-desktop.webp',
    width: 1440,
    height: 900,
    alt: 'Export dialog in the editor',
  },
  'video.export-dialog': {
    src: '/feature-shots/export-desktop.webp',
    width: 1440,
    height: 900,
    alt: 'Export dialog in the editor',
  },
  'video.frame-strip': {
    src: '/hero-assets/editor-new-york.webp',
    width: 1600,
    height: 924,
    alt: 'Print Map Studio editor',
  },
  'video.clip': {
    src: '/hero-assets/editor-new-york.webp',
    width: 1600,
    height: 924,
    alt: 'Print Map Studio editor',
  },
  'isochrone.map': {
    src: '/marketing/travel-time/amsterdam-walking-time-map.webp',
    width: 1600,
    height: 1200,
    alt: 'Amsterdam map with nested 10, 20 and 30 minute walking areas around Dam Square',
  },
  'isochrone.controls': {
    src: '/explore-shots/map-features.webp',
    width: 1130,
    height: 1716,
    alt: 'Map feature settings in the editor',
  },
  'realestate.flyer': {
    src: '/marketing/real-estate/clifton-location-map-flyer.webp',
    width: 1600,
    height: 1200,
    alt: 'A4 location map flyer for a Bristol street with nearby places, a 15-minute walking area and a QR code',
  },
  'realestate.places': {
    src: '/explore-shots/waypoint-style.webp',
    width: 1130,
    height: 1716,
    alt: 'Place marker settings in the editor',
  },
  'compare.export-dialog': {
    src: '/feature-shots/export-desktop.webp',
    width: 1440,
    height: 900,
    alt: 'Export dialog with PNG, PDF, layered SVG and layered PSD options',
  },
  'sizes.page-presets': {
    src: '/explore-shots/printable-page-frame.webp',
    width: 915,
    height: 715,
    alt: 'Page size settings for a printable map',
  },
  'share.dialog': {
    src: '/explore-shots/export-project-download.webp',
    width: 860,
    height: 780,
    alt: 'Project download options in the editor',
  },
  'share.embed-example': {
    src: '/hero-assets/editor-new-york.webp',
    width: 1600,
    height: 924,
    alt: 'Print Map Studio editor',
  },
  'qr.poster-detail': {
    src: '/marketing/real-estate/location-qr-code-detail.webp',
    width: 1200,
    height: 800,
    alt: 'Corner of a printed map with a scannable location QR code',
  },
  'og.index': og('free printable map poster maker'),
  'og.printable-map-maker': og('printable map maker'),
  'og.gpx-map-maker': og('GPX map maker'),
  'og.layered-map-export': og('layered map export'),
  'og.about': og('about the project'),
  'og.privacy': og('privacy'),
  'og.product-facts': og('product facts'),
  'og.city-map-poster': og('city map posters'),
  'og.country-map-poster': og('country map posters'),
  'og.wedding-map-poster': og('wedding map posters'),
  'og.travel-map-with-photos': og('travel maps with photos'),
  'og.map-poster-templates': og('map poster templates'),
  'og.route-map-poster': og('route map posters'),
  'og.topographic-map-maker': og('topographic map maker'),
  'og.3d-terrain-map-stl': og('3D terrain maps as STL'),
  'og.map-video-maker': og('map video maker'),
  'og.travel-time-map': og('travel time maps'),
  'og.real-estate-location-map': og('real estate location maps'),
  'og.printmaps-net-alternative': og('a printmaps.net alternative'),
  'og.map-print-size-guide': og('map print size guide'),
  'og.share-and-embed-maps': og('share and embed maps'),
} as const satisfies Record<string, MarketingImage>;

export type MediaKey = keyof typeof media;

export function getMedia(key: MediaKey): MarketingImage {
  return media[key];
}
