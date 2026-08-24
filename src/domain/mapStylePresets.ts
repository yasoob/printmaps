export const MAP_STYLE_TOKEN_ROLES = [
  'canvas',
  'land',
  'water',
  'park',
  'building',
  'majorRoad',
  'minorRoad',
  'boundary',
  'transit',
  'label',
  'labelHalo',
] as const;

export type MapStyleTokenRole = typeof MAP_STYLE_TOKEN_ROLES[number];
export type MapStyleTokens = Record<MapStyleTokenRole, string>;
export type MapStyleFamily = 'minimal' | 'editorial' | 'dark' | 'soft' | 'natural' | 'playful';

export const MAP_STYLE_PRESETS = [
  {
    id: 'paper',
    label: 'Paper',
    family: 'minimal',
    description: 'Warm paper, charcoal labels and restrained roads.',
    thumbnailUrl: '/style-thumbnails/paper.png',
    tokens: { canvas: '#f4f0e7', land: '#f8f4eb', water: '#cbdde1', park: '#dfe6d4', building: '#dfd8cc', majorRoad: '#fdfbf6', minorRoad: '#eee9df', boundary: '#aaa297', transit: '#967b57', label: '#343332', labelHalo: '#faf7ef' },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    family: 'minimal',
    description: 'Cool monochrome with crisp editorial contrast.',
    thumbnailUrl: '/style-thumbnails/graphite.png',
    tokens: { canvas: '#e8eaec', land: '#f1f2f3', water: '#c7cdd2', park: '#d9ddda', building: '#d1d4d6', majorRoad: '#ffffff', minorRoad: '#e2e4e6', boundary: '#9ba0a5', transit: '#71777d', label: '#25282b', labelHalo: '#f4f5f6' },
  },
  {
    id: 'porcelain',
    label: 'Porcelain',
    family: 'editorial',
    description: 'Bright gallery surface with fine blue-gray detail.',
    thumbnailUrl: '/style-thumbnails/porcelain.png',
    tokens: { canvas: '#f4f7f7', land: '#fbfcfc', water: '#d8e9ef', park: '#e4eee6', building: '#e8ebeb', majorRoad: '#ffffff', minorRoad: '#eef1f2', boundary: '#aebcc2', transit: '#7393a0', label: '#2c383c', labelHalo: '#ffffff' },
  },
  {
    id: 'sandstone',
    label: 'Sandstone',
    family: 'editorial',
    description: 'Warm stone, clay buildings and deep brown type.',
    thumbnailUrl: '/style-thumbnails/sandstone.png',
    tokens: { canvas: '#e9dfcf', land: '#f2e8d9', water: '#bdced0', park: '#d8dfc6', building: '#d8c3ad', majorRoad: '#fff9ef', minorRoad: '#e7dac8', boundary: '#a88e77', transit: '#a86349', label: '#4a382e', labelHalo: '#f5ecdf' },
  },
  {
    id: 'night-ink',
    label: 'Night Ink',
    family: 'dark',
    description: 'Near-black field with ivory labels and muted gold transit.',
    thumbnailUrl: '/style-thumbnails/night-ink.png',
    tokens: { canvas: '#111416', land: '#181d20', water: '#1b3038', park: '#22332c', building: '#2a2e31', majorRoad: '#4d4a43', minorRoad: '#303438', boundary: '#51585c', transit: '#b4935f', label: '#f0eadf', labelHalo: '#111416' },
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    family: 'dark',
    description: 'Deep navy with cyan structure and pale technical labels.',
    thumbnailUrl: '/style-thumbnails/blueprint.png',
    tokens: { canvas: '#0d2235', land: '#102b43', water: '#0b3d58', park: '#173e4a', building: '#1d4058', majorRoad: '#4d9bb1', minorRoad: '#28576c', boundary: '#5d8595', transit: '#65c2cf', label: '#d9eef2', labelHalo: '#0d2235' },
  },
  {
    id: 'sea-glass',
    label: 'Sea Glass',
    family: 'soft',
    description: 'Cream land, pale aqua water and quiet teal detail.',
    thumbnailUrl: '/style-thumbnails/sea-glass.png',
    tokens: { canvas: '#e7efeb', land: '#f4f1e8', water: '#bcdedc', park: '#d7e5d2', building: '#dedfd7', majorRoad: '#fffdf8', minorRoad: '#e7e7df', boundary: '#91aaa7', transit: '#5d9691', label: '#3d5557', labelHalo: '#f5f3ec' },
  },
  {
    id: 'rosewater',
    label: 'Rosewater',
    family: 'soft',
    description: 'Blush-neutral land with plum-gray labels.',
    thumbnailUrl: '/style-thumbnails/rosewater.png',
    tokens: { canvas: '#efe8e7', land: '#f7efed', water: '#d9e2e6', park: '#e5e4d4', building: '#ead9d8', majorRoad: '#fffafa', minorRoad: '#eee3e2', boundary: '#b4a3a6', transit: '#a7747d', label: '#55444d', labelHalo: '#faf3f1' },
  },
  {
    id: 'alpine',
    label: 'Alpine',
    family: 'natural',
    description: 'Sage parks, mineral water and warm-gray roads.',
    thumbnailUrl: '/style-thumbnails/alpine.png',
    tokens: { canvas: '#e6e4da', land: '#eeece1', water: '#9fc3ca', park: '#b9c9a8', building: '#d3d0c4', majorRoad: '#fffdf4', minorRoad: '#dedbd1', boundary: '#8d958b', transit: '#8b7252', label: '#37423d', labelHalo: '#f1efe5' },
  },
  {
    id: 'coastal',
    label: 'Coastal',
    family: 'natural',
    description: 'Fresh vegetation, bright land and strong sea contrast.',
    thumbnailUrl: '/style-thumbnails/coastal.png',
    tokens: { canvas: '#d9e6e8', land: '#f3eee0', water: '#79b6c8', park: '#b7d29d', building: '#ded5c6', majorRoad: '#fffdf6', minorRoad: '#e9e2d5', boundary: '#789295', transit: '#df8f55', label: '#243f4b', labelHalo: '#f5f1e7' },
  },
  {
    id: 'terracotta',
    label: 'Terracotta',
    family: 'playful',
    description: 'Warm clay accents, cream roads and muted blue water.',
    thumbnailUrl: '/style-thumbnails/terracotta.png',
    tokens: { canvas: '#e7d3bf', land: '#f2ddc6', water: '#8cabb2', park: '#c5c79c', building: '#d79776', majorRoad: '#fff0d8', minorRoad: '#e9c9ae', boundary: '#9c6e5c', transit: '#b95238', label: '#4a3028', labelHalo: '#f3dfca' },
  },
  {
    id: 'signal',
    label: 'Signal',
    family: 'playful',
    description: 'Clean neutral map with one energetic coral accent.',
    thumbnailUrl: '/style-thumbnails/signal.png',
    tokens: { canvas: '#e8e8e4', land: '#f5f4ef', water: '#b8d5df', park: '#d6e1c4', building: '#dddcd5', majorRoad: '#ffffff', minorRoad: '#e8e6df', boundary: '#9a9a94', transit: '#ef5a47', label: '#292d30', labelHalo: '#f7f6f1' },
  },
] as const satisfies readonly {
  id: string;
  label: string;
  family: MapStyleFamily;
  description: string;
  thumbnailUrl: string;
  tokens: MapStyleTokens;
}[];

export type MapStylePreset = typeof MAP_STYLE_PRESETS[number]['id'];

export const MAP_STYLE_PRESET_LABELS = Object.fromEntries(
  MAP_STYLE_PRESETS.map(({ id, label }) => [id, label]),
) as Record<MapStylePreset, string>;
