type StyleLayer = {
  id: string;
  type?: string;
  layout?: Record<string, unknown>;
};

type TextScaleMap = {
  getStyle: () => { layers?: readonly StyleLayer[] };
  setLayoutProperty: (layerId: string, property: string, value: unknown) => void;
};

type TextSize = number | unknown[];

function scaleOutput(value: unknown, factor: number): unknown {
  return typeof value === 'number' ? value * factor : ['*', value, factor];
}

function scaleExpression(expression: unknown[], factor: number): unknown[] {
  if (expression[0] === 'interpolate') {
    return expression.map((value, index) => index >= 4 && index % 2 === 0 ? scaleOutput(value, factor) : value);
  }
  if (expression[0] === 'step') {
    return expression.map((value, index) => index === 2 || (index >= 4 && index % 2 === 0)
      ? scaleOutput(value, factor)
      : value);
  }
  return ['*', expression, factor];
}

function scaledTextSize(textSize: TextSize, textScalePercent: number): TextSize {
  if (textScalePercent === 100) return textSize;
  const factor = textScalePercent / 100;
  return typeof textSize === 'number' ? textSize * factor : scaleExpression(textSize, factor);
}

export function createMapTextScaleController(map: TextScaleMap) {
  const originalTextSizes = new Map<string, TextSize>();
  const styleLayers = map.getStyle().layers ?? [];
  for (const layer of styleLayers) {
    if (layer.type !== 'symbol' || layer.layout?.['text-field'] === undefined) continue;
    const textSize = layer.layout['text-size'];
    originalTextSizes.set(layer.id, typeof textSize === 'number' || Array.isArray(textSize) ? textSize : 16);
  }

  return {
    apply(textScalePercent: number) {
      for (const [layerId, textSize] of originalTextSizes) {
        map.setLayoutProperty(layerId, 'text-size', scaledTextSize(textSize, textScalePercent));
      }
    },
  };
}
