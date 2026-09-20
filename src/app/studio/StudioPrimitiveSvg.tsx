import { Fragment, type ReactNode } from 'react';
import { decimal, type StudioBox } from '../../print/studioGeometry';
import { STUDIO_FONTS, type StudioPrimitive } from '../../print/studioPrimitives';

function boxProps(box: StudioBox) {
  return { x: decimal(box.x), y: decimal(box.y), width: decimal(box.width), height: decimal(box.height) };
}

function primitiveElement(primitive: StudioPrimitive, id: string): ReactNode {
  if (primitive.kind === 'image') {
    const { box } = primitive;
    return <>
      <defs><clipPath id={`${id}-photo`}>{primitive.shape === 'circle'
        ? <circle cx={decimal(box.x + box.width / 2)} cy={decimal(box.y + box.height / 2)} r={decimal(Math.min(box.width, box.height) / 2)} />
        : <rect {...boxProps(box)} />}</clipPath></defs>
      <image {...boxProps(primitive.imageBox)} href={primitive.asset.dataUri} preserveAspectRatio="none" clipPath={`url(#${id}-photo)`} />
    </>;
  }
  if (primitive.kind === 'text') return <text x={decimal(primitive.point.x)} y={decimal(primitive.point.y)}
    fontFamily={STUDIO_FONTS[primitive.font]} fontSize={decimal(primitive.size)} fill={primitive.color}
    textAnchor={({ left: 'start', center: 'middle', right: 'end' } as const)[primitive.align]}
    textLength={decimal(primitive.width)} lengthAdjust="spacingAndGlyphs">{primitive.text}</text>;
  const paint = { fill: primitive.fill, stroke: primitive.stroke ?? 'none',
    strokeWidth: decimal(primitive.strokeWidth ?? 0), opacity: decimal(primitive.opacity ?? 1) };
  if (primitive.kind === 'rect') return <rect {...boxProps(primitive.box)} {...paint} />;
  if (primitive.kind === 'circle') return <circle cx={decimal(primitive.center.x)} cy={decimal(primitive.center.y)} r={decimal(primitive.radius)} {...paint} />;
  const path = primitive.points.map((point, index) => `${index ? 'L' : 'M'} ${decimal(point.x)} ${decimal(point.y)}`).join(' ');
  return <path d={`${path}${primitive.closed ? ' Z' : ''}`} {...paint} />;
}

export function studioPrimitiveElements(primitives: readonly StudioPrimitive[], prefix: string) {
  return primitives.map((primitive, index) => {
    const key = primitive.key ?? `${primitive.kind}-${index}`;
    const id = `${prefix}-${[...key].map((character) => character.codePointAt(0)!.toString(16)).join('-')}`;
    const element = primitiveElement(primitive, id);
    return <Fragment key={key}>{primitive.clip ? <>
      <defs><clipPath id={`${id}-clip`}><rect {...boxProps(primitive.clip)} /></clipPath></defs>
      <g clipPath={`url(#${id}-clip)`}>{element}</g>
    </> : element}</Fragment>;
  });
}
