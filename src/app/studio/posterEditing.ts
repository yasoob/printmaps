import type { PosterSettings } from '../../domain/studio';

export function editablePoster(poster: PosterSettings): PosterSettings {
  if (poster.enabled) return poster;
  return {
    ...poster,
    marginsMm: { top: 0, right: 0, bottom: 0, left: 0 },
    title: { ...poster.title, enabled: false },
    subtitle: { ...poster.subtitle, enabled: false },
    caption: { ...poster.caption, enabled: false },
    coordinates: { ...poster.coordinates, enabled: false },
  };
}
