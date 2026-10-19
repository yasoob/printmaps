/**
 * Marketing image registry. Pages reference screenshots and OG images only through
 * `media['<key>']`, so files can be regenerated with scripts/marketing-media/capture.mts
 * without touching page code. Every image is captured from the real editor; see
 * tests/marketing-media/scenes.ts for the demo projects.
 */
export type MarketingImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /**
  Art-directed crop for narrow screens.
  */
  mobileSrc?: string;
  mobileWidth?: number;
  mobileHeight?: number;
  /**
   * Optional short muted loop; `src` is its poster frame.
   */
  video?: { src: string; type: 'video/mp4' | 'video/webm' };
};

export const media = {
  'hero.desktop': {
    src: '/marketing/hero/editor-lisbon-poster-layout.webp', width: 1600, height: 924,
    alt: 'Print Map Studio editor with an A3 Lisbon poster, a walking route and four named places',
    mobileSrc: '/marketing/hero/editor-lisbon-mobile.webp', mobileWidth: 780, mobileHeight: 1200,
  },
  'hero.mobile': {
    src: '/marketing/hero/editor-lisbon-mobile.webp', width: 780, height: 1200,
    alt: 'The editor on a phone with a Lisbon walking route poster on the page',
  },
  'editor.map-tab': {
    src: '/marketing/editor/map-tab-style-gallery.webp', width: 1600, height: 1000,
    alt: 'Map tab with the twelve map styles next to a Kyoto poster',
    mobileSrc: '/marketing/editor/map-tab-style-gallery-mobile.webp', mobileWidth: 800, mobileHeight: 1290,
  },
  'editor.layout-tab': {
    src: '/marketing/editor/layout-tab-poster-text.webp', width: 1600, height: 1000,
    alt: 'Layout tab with title, subtitle and font settings for a Lisbon poster',
    mobileSrc: '/marketing/editor/layout-tab-poster-text-mobile.webp', mobileWidth: 800, mobileHeight: 1290,
  },
  'editor.layer-route': {
    src: '/marketing/editor/route-layer-selected.webp', width: 1600, height: 1000,
    alt: 'A road trip route selected on the map, with its colour, width and dashed line settings',
    mobileSrc: '/marketing/editor/route-layer-selected-mobile.webp', mobileWidth: 800, mobileHeight: 1290,
  },
  'editor.export-print': {
    src: '/marketing/editor/export-dialog-print-preview.webp', width: 1600, height: 1333,
    alt: 'Export dialog with a preview of the Lisbon poster and PNG, SVG, PSD and PDF options',
  },
  'editor.export-video': {
    src: '/marketing/video/export-dialog-video-tab.webp', width: 1600, height: 1333,
    alt: 'Video tab of the Export dialog set to a 10 second orbit',
  },
  'editor.export-3d': {
    src: '/marketing/stl/export-dialog-3d-model-tab.webp', width: 1600, height: 1333,
    alt: '3D model tab of the Export dialog with relief size, base thickness and exaggeration',
  },
  'editor.wall-preview': {
    src: '/marketing/editor/wall-preview-framed-poster.webp', width: 1600, height: 1333,
    alt: 'Wall preview of the Edinburgh poster in an oak frame with a white mat',
  },
  'editor.share': {
    src: '/marketing/editor/share-dialog-over-editor.webp', width: 1600, height: 1000,
    alt: 'Share dialog open over the editor with a read-only link and embed code',
  },
  'editor.templates': {
    src: '/marketing/templates/new-from-template-gallery.webp', width: 1600, height: 1747,
    alt: 'New from template dialog with five poster designs and four starter cities',
  },
  'styles.grid': {
    src: '/marketing/styles/twelve-map-styles.webp', width: 1600, height: 988,
    alt: 'The same Copenhagen map in all twelve styles, from Paper to Signal',
  },
  'city.poster': {
    src: '/marketing/city/lisbon-city-map-poster.webp', width: 1600, height: 1200,
    alt: 'A3 Lisbon city map poster with the title block under the map',
  },
  'city.detail': {
    src: '/marketing/city/lisbon-poster-street-detail.webp', width: 1600, height: 1000,
    alt: 'Close-up of the Lisbon poster around Baixa and Alfama, with street names readable at print size',
  },
  'country.poster-filled': {
    src: '/marketing/country/italy-country-shaped-map-poster.webp', width: 1600, height: 1200,
    alt: 'Italy poster where the map is cut to the outline of the country, with Sicily and Sardinia included',
  },
  'country.frame-controls': {
    src: '/marketing/country/country-outline-map-frame-controls.webp', width: 1600, height: 1141,
    alt: 'Map frame set to Country / region with the Italy outline applied',
    mobileSrc: '/marketing/country/country-outline-map-frame-controls-mobile.webp', mobileWidth: 800, mobileHeight: 1291,
  },
  'wedding.poster': {
    src: '/marketing/wedding/edinburgh-wedding-map-poster.webp', width: 1600, height: 1200,
    alt: 'Edinburgh wedding map poster with two heart markers joined by a dashed arc',
  },
  'wedding.detail': {
    src: '/marketing/wedding/two-places-joined-by-an-arc.webp', width: 1600, height: 1231,
    alt: 'Detail of the wedding poster: a dashed arc from Where we met to Where we said yes',
  },
  'photos.poster': {
    src: '/marketing/photos/utah-road-trip-photo-map-poster.webp', width: 1600, height: 1200,
    alt: 'Southern Utah road trip poster with photos pinned to four parks and a numbered photo strip',
  },
  'photos.controls': {
    src: '/marketing/photos/photo-story-controls.webp', width: 1600, height: 1141,
    alt: 'Photos settings with four trip photos, captions and the photo strip switched on',
    mobileSrc: '/marketing/photos/photo-story-controls-mobile.webp', mobileWidth: 800, mobileHeight: 1291,
  },
  'templates.gallery': {
    src: '/marketing/templates/new-from-template-gallery.webp', width: 1600, height: 1747,
    alt: 'New from template dialog with five poster designs and four starter cities',
  },
  'templates.examples': {
    src: '/marketing/templates/lisbon-three-poster-layouts.webp', width: 1600, height: 803,
    alt: 'The same Lisbon map in three layouts: City edition, Quiet lines and After dark',
  },
  'route.poster': {
    src: '/marketing/route/london-marathon-route-poster.webp', width: 1600, height: 1200,
    alt: 'Dark A3 marathon poster of a 42.3 km run along the Thames with start and finish markers',
  },
  'route.elevation': {
    src: '/marketing/route/mont-ventoux-elevation-profile.webp', width: 1600, height: 900,
    alt: 'Elevation profile of the Mont Ventoux climb from Bédoin, 312 m to 1,880 m over 19 km',
    mobileSrc: '/marketing/route/mont-ventoux-elevation-panel-mobile.webp', mobileWidth: 800, mobileHeight: 1291,
  },
  'route.cycling-poster': {
    src: '/marketing/route/mont-ventoux-cycling-route-poster.webp', width: 1600, height: 1200,
    alt: 'A3 poster of the Mont Ventoux climb from Bédoin on a contour map, with the summit marked',
  },
  'route.elevation-panel': {
    src: '/marketing/route/mont-ventoux-elevation-panel.webp', width: 1600, height: 1141,
    alt: 'Elevation section of a selected route with the profile chart, ascent and SVG, PNG and PDF downloads',
    mobileSrc: '/marketing/route/mont-ventoux-elevation-panel-mobile.webp', mobileWidth: 800, mobileHeight: 1291,
  },
  'topo.contours': {
    src: '/marketing/topo/matterhorn-contour-map.webp', width: 1600, height: 1200,
    alt: 'Topographic poster of Zermatt and the Matterhorn with contour lines every 50 metres',
  },
  'topo.terrain-3d': {
    src: '/marketing/topo/matterhorn-3d-terrain-with-contours.webp', width: 1600, height: 1141,
    alt: 'Tilted 3D terrain around the Matterhorn with contour lines and the Terrain settings open',
    mobileSrc: '/marketing/topo/matterhorn-3d-terrain-with-contours-mobile.webp', mobileWidth: 800, mobileHeight: 1291,
  },
  'stl.relief-preview': {
    src: '/marketing/stl/matterhorn-stl-relief-preview.webp', width: 1600, height: 1100,
    alt: 'Render of the Matterhorn STL relief exported from the editor, ready for a slicer',
  },
  'stl.export-dialog': {
    src: '/marketing/stl/export-dialog-3d-model-tab.webp', width: 1600, height: 1333,
    alt: '3D model tab of the Export dialog with relief size, base thickness and exaggeration',
  },
  'video.export-dialog': {
    src: '/marketing/video/export-dialog-video-tab.webp', width: 1600, height: 1333,
    alt: 'Video tab of the Export dialog set to a 10 second orbit of a New York poster',
  },
  'video.frame-strip': {
    src: '/marketing/video/orbit-video-frame-strip.webp', width: 1600, height: 264,
    alt: 'Five frames from an orbit video of a New York poster as the camera turns',
  },
  'video.clip': {
    src: '/marketing/video/new-york-orbit-poster-frame.webp', width: 1200, height: 850,
    alt: 'Orbit video of a dark New York map poster turning slowly',
    video: { src: '/marketing/video/new-york-orbit-loop.mp4', type: 'video/mp4' },
  },
  'isochrone.map': {
    src: '/marketing/travel-time/amsterdam-walking-time-map.webp', width: 1600, height: 1200,
    alt: 'Amsterdam map with nested 10, 20 and 30 minute walking areas around Dam Square',
  },
  'isochrone.controls': {
    src: '/marketing/travel-time/travel-time-area-controls.webp', width: 1600, height: 1141,
    alt: 'Travel time panel with Dam Square as the start, walking mode and a 15 minute duration',
    mobileSrc: '/marketing/travel-time/travel-time-area-controls-mobile.webp', mobileWidth: 800, mobileHeight: 1290,
  },
  'realestate.flyer': {
    src: '/marketing/real-estate/clifton-location-map-flyer.webp', width: 1600, height: 1200,
    alt: 'A4 location map flyer for a Bristol street with nearby places, a 15-minute walking area and a QR code',
  },
  'realestate.places': {
    src: '/marketing/real-estate/bulk-places-address-lookup.webp', width: 1600, height: 1141,
    alt: 'Place multiple panel matching a pasted list of Bristol addresses to their locations before adding them',
    mobileSrc: '/marketing/real-estate/bulk-places-address-lookup-mobile.webp', mobileWidth: 800, mobileHeight: 1290,
  },
  'compare.export-dialog': {
    src: '/marketing/compare/export-dialog-pdf-option.webp', width: 1600, height: 1333,
    alt: 'Export dialog with PDF selected, showing the exact A3 page size and how the file is built',
  },
  'sizes.page-presets': {
    src: '/marketing/sizes/page-size-presets.webp', width: 1600, height: 1141,
    alt: 'Page size list with A2 to A6, US Letter and Custom next to an A3 portrait poster',
    mobileSrc: '/marketing/sizes/page-size-presets-mobile.webp', mobileWidth: 800, mobileHeight: 1291,
  },
  'share.dialog': {
    src: '/marketing/share/share-link-and-embed-dialog.webp', width: 1200, height: 942,
    alt: 'Share dialog with a read-only link, a pan and zoom toggle for the embed, and the iframe code',
  },
  'share.embed-example': {
    src: '/marketing/share/embedded-map-in-a-blog-post.webp', width: 1600, height: 1147,
    alt: 'A blog post with a read-only Lisbon map embedded through an iframe',
  },
  'qr.poster-detail': {
    src: '/marketing/real-estate/location-qr-code-detail.webp', width: 1200, height: 800,
    alt: 'Corner of a printed map with a scannable location QR code',
  },
  'og.index': {
    src: '/marketing/og/index.jpg', width: 1200, height: 630,
    alt: 'Print Map Studio, a free map poster maker',
  },
  'og.printable-map-maker': {
    src: '/marketing/og/printable-map-maker.jpg', width: 1200, height: 630,
    alt: 'Printable map maker with exact page sizes and PDF, SVG and PSD export',
  },
  'og.gpx-map-maker': {
    src: '/marketing/og/gpx-map-maker.jpg', width: 1200, height: 630,
    alt: 'GPX map maker: a cycling track printed on a contour map',
  },
  'og.layered-map-export': {
    src: '/marketing/og/layered-map-export.jpg', width: 1200, height: 630,
    alt: 'Layered map export in SVG, PSD, PDF and PNG',
  },
  'og.about': {
    src: '/marketing/og/about.jpg', width: 1200, height: 630,
    alt: 'About Print Map Studio, an open-source map editor for print',
  },
  'og.privacy': {
    src: '/marketing/og/privacy.jpg', width: 1200, height: 630,
    alt: 'Privacy at Print Map Studio: maps stay in your browser',
  },
  'og.product-facts': {
    src: '/marketing/og/product-facts.jpg', width: 1200, height: 630,
    alt: 'Print Map Studio product facts and specifications',
  },
  'og.city-map-poster': {
    src: '/marketing/og/city-map-poster.jpg', width: 1200, height: 630,
    alt: 'City map poster of Lisbon made in Print Map Studio',
  },
  'og.country-map-poster': {
    src: '/marketing/og/country-map-poster.jpg', width: 1200, height: 630,
    alt: 'Country map poster shaped like Italy',
  },
  'og.wedding-map-poster': {
    src: '/marketing/og/wedding-map-poster.jpg', width: 1200, height: 630,
    alt: 'Wedding map poster of Edinburgh with two hearts',
  },
  'og.travel-map-with-photos': {
    src: '/marketing/og/travel-map-with-photos.jpg', width: 1200, height: 630,
    alt: 'Travel map with photos pinned along a Utah road trip',
  },
  'og.map-poster-templates': {
    src: '/marketing/og/map-poster-templates.jpg', width: 1200, height: 630,
    alt: 'Map poster templates in the New from template dialog',
  },
  'og.route-map-poster': {
    src: '/marketing/og/route-map-poster.jpg', width: 1200, height: 630,
    alt: 'Route map poster of a marathon along the Thames',
  },
  'og.topographic-map-maker': {
    src: '/marketing/og/topographic-map-maker.jpg', width: 1200, height: 630,
    alt: 'Topographic map of the Matterhorn with contour lines',
  },
  'og.3d-terrain-map-stl': {
    src: '/marketing/og/3d-terrain-map-stl.jpg', width: 1200, height: 630,
    alt: '3D terrain relief of the Matterhorn exported as STL',
  },
  'og.map-video-maker': {
    src: '/marketing/og/map-video-maker.jpg', width: 1200, height: 630,
    alt: 'Map video maker: an orbit clip of a New York poster',
  },
  'og.travel-time-map': {
    src: '/marketing/og/travel-time-map.jpg', width: 1200, height: 630,
    alt: 'Travel time map of Amsterdam with walking rings',
  },
  'og.real-estate-location-map': {
    src: '/marketing/og/real-estate-location-map.jpg', width: 1200, height: 630,
    alt: 'Real estate location map flyer for a Bristol street',
  },
  'og.printmaps-net-alternative': {
    src: '/marketing/og/printmaps-net-alternative.jpg', width: 1200, height: 630,
    alt: 'A free printmaps.net alternative with PDF and layered files',
  },
  'og.map-print-size-guide': {
    src: '/marketing/og/map-print-size-guide.jpg', width: 1200, height: 630,
    alt: 'Map print size guide: paper sizes, DPI and pixels',
  },
  'og.share-and-embed-maps': {
    src: '/marketing/og/share-and-embed-maps.jpg', width: 1200, height: 630,
    alt: 'Share and embed maps: a read-only Lisbon map embedded in a blog post',
  },
} as const satisfies Record<string, MarketingImage>;

export type MediaKey = keyof typeof media;

export function getMedia(key: MediaKey): MarketingImage {
  return media[key];
}
