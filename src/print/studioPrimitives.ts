import type { PhotoAsset, StudioFont } from '../domain/studio';
import { boxAttributes, decimal, xml, type StudioBox, type StudioPoint } from './studioGeometry';

type Paint = Readonly<{ fill: string; stroke?: string; strokeWidth?: number; opacity?: number; clip?: StudioBox }>;
type StudioPrimitiveData =
  | Readonly<Paint & { kind: 'rect'; box: StudioBox }>
  | Readonly<Paint & { kind: 'circle'; center: StudioPoint; radius: number }>
  | Readonly<Paint & { kind: 'path'; points: readonly StudioPoint[]; closed: boolean }>
  | Readonly<{ kind: 'text'; text: string; point: StudioPoint; size: number; width: number; color: string; font: StudioFont; align: 'left' | 'center' | 'right'; clip?: StudioBox }>
  | Readonly<{ kind: 'image'; asset: PhotoAsset; box: StudioBox; imageBox: StudioBox; shape: 'square' | 'circle'; clip?: StudioBox }>;
export type StudioPrimitive = StudioPrimitiveData & Readonly<{ key?: string }>;

export const STUDIO_FONTS: Readonly<Record<StudioFont, string>> = {
  sans: 'Arial, Helvetica, sans-serif',
  serif: 'Times New Roman, Times, serif',
  mono: 'Courier New, Courier, monospace',
};

export function studioText(
  text: string,
  point: StudioPoint,
  options: Readonly<{ size: number; maxWidth: number; font: StudioFont; color: string; align?: 'left' | 'center' | 'right' }>,
): StudioPrimitive {
  const estimate = Math.max(1, [...text].length) * (options.font === 'mono' ? 0.6 : 0.56);
  const size = Math.min(options.size, options.maxWidth / estimate);
  return { kind: 'text', text, point, size, width: Math.min(options.maxWidth, estimate * size), color: options.color, font: options.font, align: options.align ?? 'center' };
}

function paintAttributes(primitive: Paint): string {
  return `fill="${xml(primitive.fill)}" stroke="${xml(primitive.stroke ?? 'none')}" stroke-width="${decimal(primitive.strokeWidth ?? 0)}" opacity="${decimal(primitive.opacity ?? 1)}"`;
}

function imageClip(primitive: Extract<StudioPrimitive, { kind: 'image' }>): string {
  const { box } = primitive;
  return primitive.shape === 'circle'
    ? `<circle cx="${decimal(box.x + box.width / 2)}" cy="${decimal(box.y + box.height / 2)}" r="${decimal(Math.min(box.width, box.height) / 2)}"/>`
    : `<rect ${boxAttributes(box)}/>`;
}

function primitiveSvg(primitive: StudioPrimitive, id: string): string {
  switch (primitive.kind) {
    case 'rect': { return `<rect ${boxAttributes(primitive.box)} ${paintAttributes(primitive)}/>`;
    }
    case 'circle': { return `<circle cx="${decimal(primitive.center.x)}" cy="${decimal(primitive.center.y)}" r="${decimal(primitive.radius)}" ${paintAttributes(primitive)}/>`;
    }
    case 'path': {
      const path = primitive.points.map((point, index) => `${index ? 'L' : 'M'} ${decimal(point.x)} ${decimal(point.y)}`).join(' ');
      return `<path d="${path}${primitive.closed ? ' Z' : ''}" ${paintAttributes(primitive)}/>`;
    }
    case 'text': {
      const anchor = { left: 'start', center: 'middle', right: 'end' }[primitive.align];
      return `<text x="${decimal(primitive.point.x)}" y="${decimal(primitive.point.y)}" font-family="${xml(STUDIO_FONTS[primitive.font])}" font-size="${decimal(primitive.size)}" fill="${xml(primitive.color)}" text-anchor="${anchor}" textLength="${decimal(primitive.width)}" lengthAdjust="spacingAndGlyphs">${xml(primitive.text)}</text>`;
    }
    case 'image': { return `<defs><clipPath id="${id}-photo">${imageClip(primitive)}</clipPath></defs><image ${boxAttributes(primitive.imageBox)} href="${xml(primitive.asset.dataUri)}" preserveAspectRatio="none" clip-path="url(#${id}-photo)"/>`;
    }
  }
}

export function serializeStudioPrimitives(primitives: readonly StudioPrimitive[], prefix = 'studio'): string {
  return primitives.map((primitive, index) => {
    const id = `${prefix}-${index}`;
    const svg = primitiveSvg(primitive, id);
    if (!primitive.clip) return svg;
    return `<defs><clipPath id="${id}-clip"><rect ${boxAttributes(primitive.clip)}/></clipPath></defs><g clip-path="url(#${id}-clip)">${svg}</g>`;
  }).join('');
}
