import type { PDFFont } from 'pdf-lib';
import { vectorNumber as n, type VectorBasemapScene, type VectorColor, type VectorPoint, type VectorPath, type VectorText } from './scene';

function path(rings: readonly (readonly VectorPoint[])[], isClosed: boolean): string {
  return rings.map((ring) => ring.map((point, index) => `${n(point.x)} ${n(point.y)} ${index ? 'l' : 'm'}`).join('\n') + (isClosed ? '\nh' : '')).join('\n');
}

function color(color: VectorColor, isStroke = false): string {
  return `${color.slice(0, 3).map((value) => n(value)).join(' ')} ${isStroke ? 'RG' : 'rg'}`;
}

type AlphaCommand = (fill?: number, stroke?: number) => string;

function paintOperator(hasFill: boolean, hasStroke: boolean): string {
  if (hasFill) return hasStroke ? 'B*' : 'f*';
  return hasStroke ? 'S' : 'n';
}

function shapeCommands(shape: VectorPath, alpha: AlphaCommand): string[] {
  const stroke = shape.stroke && shape.width ? shape.stroke : undefined;
  const commands = ['q', alpha(shape.fill?.[3], stroke?.[3])];
  if (shape.fill) commands.push(color(shape.fill));
  if (stroke) commands.push(
    color(stroke, true), `${n(shape.width!)} w`, `${['butt', 'round', 'square'].indexOf(shape.cap ?? 'butt')} J`,
    `${['miter', 'round', 'bevel'].indexOf(shape.join ?? 'miter')} j`, `${n(shape.miterLimit ?? 2)} M`,
    `[${(shape.dash ?? []).map((value) => n(value)).join(' ')}] 0 d`,
  );
  commands.push(path(shape.rings, shape.closed), paintOperator(Boolean(shape.fill), Boolean(stroke)), 'Q');
  return commands;
}

function textCommands(text: VectorText, alpha: AlphaCommand, font: PDFFont): string[] {
  const commands = ['q', color(text.color), color(text.halo, true), alpha(text.color[3], text.halo[3]), `${n(text.haloWidth * 2)} w`, '1 j', 'BT', `/VBFont ${n(text.size)} Tf`, `${text.haloWidth > 0 && text.halo[3] > 0 ? 2 : 0} Tr`];
  for (const glyph of text.glyphs) {
    const cos = Math.cos(glyph.angle), sin = Math.sin(glyph.angle);
    commands.push(`${n(cos)} ${n(sin)} ${n(sin)} ${n(-cos)} ${n(glyph.x)} ${n(glyph.y)} Tm`, `${font.encodeText(glyph.text)} Tj`);
  }
  commands.push('ET', 'Q');
  return commands;
}

export function vectorPdfForm(scene: VectorBasemapScene, font?: PDFFont) {
  const states = new Map<string, string>();
  const alpha = (fill = 1, stroke = 1) => {
    const key = `${n(fill)} ${n(stroke)}`;
    let name = states.get(key);
    if (!name) { name = `VA${states.size}`; states.set(key, name); }
    return `/${name} gs`;
  };
  const commands = [`q\n1 0 0 -1 0 ${n(scene.height)} cm`];
  for (const group of scene.groups) {
    commands.push(`q\n${path([group.clip], true)}\nW n`);
    for (const shape of group.paths) commands.push(...shapeCommands(shape, alpha));
    const texts = font ? group.texts ?? [] : [];
    for (const text of texts) commands.push(...textCommands(text, alpha, font!));
    commands.push('Q');
  }
  commands.push('Q');
  const graphicsStates = [...states].map(([values, name]) => {
    const [fill, stroke] = values.split(' ', 2);
    return `/${name} << /Type /ExtGState /ca ${fill} /CA ${stroke} >>`;
  }).join(' ');
  return {
    commands: commands.join('\n'),
    graphicsStates,
    states: Object.fromEntries([...states].map(([values, name]) => {
      const [ca, CA] = values.split(' ').map(Number);
      return [name, { ca, CA }];
    })),
    dictionary: `/Type /XObject /Subtype /Form /BBox [0 0 ${n(scene.width)} ${n(scene.height)}] /Matrix [${1 / scene.width} 0 0 ${1 / scene.height} 0 0] /Group << /S /Transparency /CS /DeviceRGB /I true >> /Resources << /ExtGState << ${graphicsStates} >> >>`,
  };
}
