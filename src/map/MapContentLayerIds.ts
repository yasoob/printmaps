const LAYER_PREFIX = 'studio-layer-';

export const encodedContentId = (id: string) => `${id.length}:${id}`;

export const mapContentLayerId = (id: string, role = 'main') => (
  `${LAYER_PREFIX}${encodedContentId(id)}:${role}`
);

export const customMarkerImageId = (assetId: string) => `studio-marker-${assetId}`;
