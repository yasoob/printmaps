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
    src: '/hero-assets/editor-new-york.webp',
    width: 1600,
    height: 924,
    alt: 'A New York city map poster in the editor',
  },
  'city.detail': {
    src: '/explore-shots/labels-and-text.webp',
    width: 1130,
    height: 1716,
    alt: 'Label and text settings for a city map',
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
    src: '/explore-shots/printable-page-frame.webp',
    width: 915,
    height: 715,
    alt: 'A printable map poster with a title and subtitle',
  },
  'wedding.detail': {
    src: '/explore-shots/waypoint-style.webp',
    width: 1130,
    height: 1716,
    alt: 'Place marker style settings',
  },
  'photos.poster': {
    src: '/explore-shots/gpx-print-frame.webp',
    width: 913,
    height: 715,
    alt: 'A travel route map poster in its page frame',
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
    src: '/explore-shots/printable-page-frame.webp',
    width: 915,
    height: 715,
    alt: 'A printable map poster layout in the editor',
  },
  'route.poster': {
    src: '/explore-shots/gpx-print-frame.webp',
    width: 913,
    height: 715,
    alt: 'An imported GPS route on a printable map page',
  },
  'route.elevation': {
    src: '/explore-shots/route-advanced.webp',
    width: 1130,
    height: 1716,
    alt: 'Advanced route settings in the editor',
  },
  'topo.contours': {
    src: '/explore-shots/map-features.webp',
    width: 1130,
    height: 1716,
    alt: 'Map feature settings in the editor',
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
    src: '/explore-shots/map-features.webp',
    width: 1130,
    height: 1716,
    alt: 'Map feature settings in the editor',
  },
  'isochrone.controls': {
    src: '/explore-shots/map-features.webp',
    width: 1130,
    height: 1716,
    alt: 'Map feature settings in the editor',
  },
  'realestate.flyer': {
    src: '/explore-shots/printable-page-frame.webp',
    width: 915,
    height: 715,
    alt: 'A printable map page with places marked',
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
    src: '/explore-shots/printable-page-frame.webp',
    width: 915,
    height: 715,
    alt: 'A printable map poster in its page frame',
  },
  'og.index': og('free printable map poster maker'),
  'og.printable-map-maker': og('printable map maker'),
  'og.gpx-map-maker': og('GPX map maker'),
  'og.layered-map-export': og('layered map export'),
  'og.about': og('about the project'),
  'og.privacy': og('privacy'),
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
