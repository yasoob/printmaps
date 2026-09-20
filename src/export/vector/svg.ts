import { vectorNumber as n, vectorXml as xml, type VectorBasemapScene, type VectorColor, type VectorPath, type VectorPoint } from './scene';
import fontLicense from '@fontsource/noto-sans/LICENSE?raw';

function pathData(rings: readonly (readonly VectorPoint[])[], isClosed: boolean): string {
  return rings.map((ring) => ring.map((point, index) => `${index ? 'L' : 'M'}${n(point.x)} ${n(point.y)}`).join(' ') + (isClosed ? ' Z' : '')).join(' ');
}

function color(color: VectorColor): string {
  return `rgb(${color.slice(0, 3).map((channel) => n(channel * 255)).join(' ')})`;
}

function path(path: VectorPath): string {
  const fill = path.fill ? `fill="${color(path.fill)}" fill-opacity="${n(path.fill[3])}"` : 'fill="none"';
  const stroke = path.stroke && path.width ? ` stroke="${color(path.stroke)}" stroke-opacity="${n(path.stroke[3])}" stroke-width="${n(path.width)}" stroke-linecap="${path.cap ?? 'butt'}" stroke-linejoin="${path.join ?? 'miter'}" stroke-miterlimit="${n(path.miterLimit ?? 2)}"${path.dash ? ` stroke-dasharray="${path.dash.map((value) => n(value)).join(' ')}"` : ''}` : '';
  return `<path d="${pathData(path.rings, path.closed)}" ${fill}${stroke} fill-rule="evenodd"/>`;
}

export function serializeVectorBasemap(scene: VectorBasemapScene, width: number, height: number): string {
  if (!(scene.width > 0) || !(scene.height > 0)) throw new Error('Vector basemap dimensions must be positive.');
  const definitions = scene.groups.map((group, index) => `<clipPath id="vb-clip-${index}"><path d="${pathData([group.clip], true)}"/></clipPath>`).join('');
  const font = scene.font ? `<metadata data-font-license="SIL-OFL-1.1">${xml(fontLicense)}</metadata><style>@font-face{font-family:PrintMapVectorNoto;src:url("${scene.font.dataUri}") format("woff")}</style>` : '';
  const groups = scene.groups.map((group, index) => {
    const texts = (group.texts ?? []).map((text) => (
      `<text aria-label="${xml(text.text)}" font-family="PrintMapVectorNoto" font-size="${n(text.size)}" fill="${color(text.color)}" fill-opacity="${n(text.color[3])}" stroke="${color(text.halo)}" stroke-opacity="${n(text.halo[3])}" stroke-width="${n(text.haloWidth * 2)}" stroke-linejoin="round" paint-order="stroke fill">${text.glyphs.map((glyph) => `<tspan x="${n(glyph.x)}" y="${n(glyph.y)}" rotate="${n(glyph.angle * 180 / Math.PI)}">${xml(glyph.text)}</tspan>`).join('')}</text>`
    )).join('');
    return `<g data-map-style-layer="${xml(group.layerId)}" clip-path="url(#vb-clip-${index})">${group.paths.map((shape) => path(shape)).join('')}${texts}</g>`;
  }).join('');
  return `${font}<g transform="scale(${n(width / scene.width)} ${n(height / scene.height)})"><defs>${definitions}</defs>${groups}</g>`;
}
