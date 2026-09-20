import type { CameraSettings, MapStylePreset, ProjectDocument } from './project';
import { createDefaultStudioSettings, type PosterSettings, type PosterTemplateId, type StudioTemplateApplication } from './studio';

export type PosterTemplate = Readonly<{
  id: Exclude<PosterTemplateId, 'none'>;
  name: string;
  description: string;
  background: string;
  ink: string;
  font: 'sans' | 'serif' | 'mono';
  preset: MapStylePreset;
  layout: PosterSettings['layout'];
}>;

export const POSTER_TEMPLATES: readonly PosterTemplate[] = [
  { id: 'classic', name: 'City edition', description: 'A generous border and a traditional title block.', background: '#faf7f0', ink: '#242c32', font: 'serif', preset: 'paper', layout: 'bottom' },
  { id: 'minimal', name: 'Quiet lines', description: 'A small heading, open space, and precise coordinates.', background: '#ffffff', ink: '#292929', font: 'sans', preset: 'paper', layout: 'top' },
  { id: 'gallery', name: 'After dark', description: 'A deep border and high-contrast lettering.', background: '#15212b', ink: '#f8edda', font: 'sans', preset: 'night-ink', layout: 'bottom' },
  { id: 'silhouette', name: 'Land & outline', description: 'A country or region outlined against clean paper.', background: '#faf7f0', ink: '#243c36', font: 'serif', preset: 'paper', layout: 'bottom' },
  { id: 'journey', name: 'Field notes', description: 'A travel journal with room for a photo story.', background: '#f5efe3', ink: '#453a2d', font: 'mono', preset: 'paper', layout: 'top' },
];

export type PosterStarter = Readonly<{
  id: string; name: string; subtitle: string; templateId: PosterTemplate['id']; center: [number, number]; zoom: number;
}>;

export const POSTER_STARTERS: readonly PosterStarter[] = [
  { id: 'lisbon', name: 'Lisbon', subtitle: 'Hills, trams & the Atlantic', templateId: 'classic', center: [-9.1427, 38.7369], zoom: 12.2 },
  { id: 'kyoto', name: 'Kyoto', subtitle: 'Paths through the old capital', templateId: 'minimal', center: [135.7681, 35.0116], zoom: 11.9 },
  { id: 'new-york', name: 'New York', subtitle: 'An island of possibilities', templateId: 'gallery', center: [-73.977, 40.756], zoom: 11.9 },
  { id: 'copenhagen', name: 'Copenhagen', subtitle: 'A weekend by the water', templateId: 'journey', center: [12.5683, 55.6761], zoom: 12.1 },
];

export function posterTemplateSettings(templateId: PosterTemplate['id'], title: string, subtitle = ''): PosterSettings {
  const template = POSTER_TEMPLATES.find(({ id }) => id === templateId);
  if (!template) throw new Error('Choose an available poster template.');
  const settings = createDefaultStudioSettings().poster;
  return {
    ...settings, enabled: true, templateId, layout: template.layout, backgroundColor: template.background,
    title: { enabled: true, text: title, font: template.font, fontSizePt: 32, color: template.ink },
    subtitle: { enabled: Boolean(subtitle), text: subtitle, font: 'sans', fontSizePt: 12, color: template.ink },
    coordinates: { ...settings.coordinates, enabled: true, color: template.ink },
  };
}

export function createPosterTemplateApplication(
  document: Pick<ProjectDocument, 'title' | 'style' | 'camera'>,
  templateId: PosterTemplate['id'],
  starter?: PosterStarter,
): StudioTemplateApplication {
  const template = POSTER_TEMPLATES.find(({ id }) => id === templateId);
  if (!template) throw new Error('Choose an available poster template.');
  if (starter && document.camera.locked) throw new Error('Unlock the map area before choosing a starter location.');
  const camera: CameraSettings | undefined = starter
    ? { ...document.camera, center: [...starter.center], zoom: starter.zoom, bearing: 0, pitch: 0 }
    : undefined;
  return {
    poster: posterTemplateSettings(templateId, starter?.name ?? document.title, starter?.subtitle),
    style: { ...document.style, preset: template.preset },
    ...(camera && { camera }),
  };
}
