/**
 * Responsive variants of public/ images. `/_img/<width>/<ext>/<path>.webp` is served by the
 * responsive-images integration (resized on demand in dev, written to dist/ at build).
 */
export const RESPONSIVE_WIDTHS = [480, 800, 1200, 1600] as const;

const VARIANT_SOURCE = /^\/(?!_img\/)(.+)\.(webp|png|jpe?g)$/i;

export function variantUrl(src: string, width: number): string | undefined {
  const match = VARIANT_SOURCE.exec(src);
  if (!match) return undefined;
  const [, path = '', extension = ''] = match;
  return `/_img/${width}/${extension.toLowerCase()}/${path}.webp`;
}

/** `srcset` with smaller WebP variants plus the original at its own width. */
export function responsiveSrcset(src: string, width: number): string | undefined {
  const smaller = RESPONSIVE_WIDTHS.filter((candidate) => candidate < width * 0.9);
  const variants = smaller
    .map((candidate) => {
      const url = variantUrl(src, candidate);
      return url ? `${url} ${candidate}w` : undefined;
    })
    .filter((entry): entry is string => Boolean(entry));
  if (variants.length === 0) return undefined;
  return [...variants, `${src} ${width}w`].join(', ');
}
