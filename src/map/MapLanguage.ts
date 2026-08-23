import type { MapLanguage } from '../domain/project';

type StyleLayer = {
  id: string;
  type?: string;
  layout?: Record<string, unknown>;
};

type LanguageMap = {
  getStyle: () => { layers?: readonly StyleLayer[] };
  setLayoutProperty: (layerId: string, property: string, value: unknown) => void;
};

type LabelLayer = {
  id: string;
  localTextField: unknown;
};

const isStudioLayer = (id: string) => id.startsWith('studio-layer-');

export function createMapLanguageController(map: LanguageMap) {
  const labelLayers: LabelLayer[] = [];
  const styleLayers = map.getStyle().layers ?? [];
  for (const layer of styleLayers) {
    const textField = layer.layout?.['text-field'];
    if (textField === undefined || isStudioLayer(layer.id) || layer.type !== 'symbol') continue;
    labelLayers.push({ id: layer.id, localTextField: structuredClone(textField) });
  }

  return {
    apply(language: MapLanguage) {
      for (const layer of labelLayers) {
        const textField = language === 'local'
          ? structuredClone(layer.localTextField)
          : [
              'coalesce',
              ['get', `name:${language}`],
              ['get', `name_${language}`],
              structuredClone(layer.localTextField),
            ];
        map.setLayoutProperty(layer.id, 'text-field', textField);
      }
    },
  };
}