import { createDefaultLayerAppearance, createNewProjectDocument, normalizeCameraPrecision, type ContentLayer } from '../../src/domain/project';

export function layerNavigationProject(count = 300) {
  const project = createNewProjectDocument();
  project.id = 'layer-navigation';
  project.title = 'Layer navigation';
  project.camera = { ...project.camera, center: [16.3725, 48.2084], zoom: 13 };
  const layers: ContentLayer[] = Array.from({ length: count }, (_, index) => ({
    id: `place-${index + 1}`,
    name: `Place ${String(index + 1).padStart(3, '0')}`,
    type: 'poi', visible: true, locked: false, opacity: 100,
    appearance: createDefaultLayerAppearance('poi'),
    geometry: { type: 'Point', coordinates: [normalizeCameraPrecision(16.36 + (index % 20) * 0.001), normalizeCameraPrecision(48.2 + Math.floor(index / 20) * 0.001)] },
  }));
  project.layers.unshift(...layers);
  return project;
}

export function filteredLayerNavigationProject() {
  const project = layerNavigationProject(5);
  for (const [index, name] of ['Keep A', 'Other X', 'Keep B', 'Other Y', 'Keep C'].entries()) { project.layers[index].name = name; }
  return project;
}
