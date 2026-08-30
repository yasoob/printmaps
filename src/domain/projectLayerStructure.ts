import type { ContentLayer } from './project';

export function hasExactlyOneBottomBasemap(layers: readonly ContentLayer[]): boolean {
  return layers.at(-1)?.type === 'basemap'
    && layers.filter(({ type }) => type === 'basemap').length === 1;
}
