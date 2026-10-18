import { Activity, memo, useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, LayoutTemplate } from 'lucide-react';
import type { AdministrativeArea } from '../../domain/administrativeAreas';
import type { ContentLayer } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { DecorationSettings, PhotoSettings, PosterSettings } from '../../domain/studio';
import { POSTER_TEMPLATES, type PosterTemplate } from '../../domain/studioTemplates';
import { MAP_STYLE_PRESETS } from '../../domain/mapStylePresets';
import { InspectorAccordion } from '../components/PropertyControls';
import { DecorationControls } from './DecorationControls';
import { PhotoStoryControls, type PhotoUpload } from './PhotoStoryControls';
import { PosterControls } from './PosterControls';
import { TemplateGallery } from './TemplateGallery';
import { MapFrameControls } from './MapFrameControls';
import './studioComposition.css';

export type StudioCompositionPanelProps = Readonly<{
  poster: PosterSettings; photos: PhotoSettings; decorations: DecorationSettings;
  pointLayers: readonly Pick<ContentLayer, 'id' | 'name'>[]; documentEpoch: number; cameraLocked: boolean; isFlat: boolean;
  pageControls?: ReactNode;
  isDisabled?: boolean;
  silhouetteName: string | null;
  onPosterChange: (value: PosterSettings) => ProjectMutationResult;
  onPhotosChange: (value: PhotoSettings) => ProjectMutationResult;
  onDecorationsChange: (value: DecorationSettings) => ProjectMutationResult;
  onApplyTemplate: (id: PosterTemplate['id']) => ProjectMutationResult;
  onCreateSilhouette: (area: AdministrativeArea) => ProjectMutationResult | Promise<ProjectMutationResult>;
  onRectangle: () => ProjectMutationResult;
  onPhotoUpload: PhotoUpload;
  onPhotoRemove: (id: string) => ProjectMutationResult;
}>;

function decorationSummary(decorations: DecorationSettings) {
  const shown = [
    decorations.compass.enabled && 'Compass', decorations.scale.enabled && 'Scale',
    decorations.grid.enabled && 'Grid', decorations.qr.enabled && 'QR code',
  ].filter(Boolean);
  return shown.length > 0 ? shown.join(' · ') : 'Compass, scale, grid & QR';
}

function textSummary(poster: PosterSettings) {
  if (!poster.enabled) return 'Title, subtitle, caption & coordinates';
  const shown = (['title', 'subtitle', 'caption'] as const).filter((key) => poster[key].enabled);
  if (poster.title.enabled && poster.title.text) return poster.title.text;
  if (shown.length === 0 && !poster.coordinates.enabled) return 'No text shown';
  return [...shown.map((key) => key.charAt(0).toUpperCase() + key.slice(1)), ...(poster.coordinates.enabled ? ['Coordinates'] : [])].join(' · ');
}

const LayoutPresetEntry = memo(function LayoutPresetEntry({ templateId, isEnabled, isDisabled, buttonRef, onOpen }: {
  templateId: PosterSettings['templateId']; isEnabled: boolean; isDisabled?: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>; onOpen: () => void;
}) {
  const nameId = useId();
  const template = isEnabled ? POSTER_TEMPLATES.find(({ id }) => id === templateId) : undefined;
  const name = template?.name ?? (isEnabled ? 'Custom layout' : 'Map only');
  const thumbnail = template && MAP_STYLE_PRESETS.find(({ id }) => id === template.preset)?.thumbnailUrl;
  return <button ref={buttonRef} className="inspector-layout-entry" type="button" aria-label="Change layout" aria-describedby={nameId}
    disabled={isDisabled} onClick={onOpen}>
    <span className="inspector-layout-thumb" aria-hidden="true" style={template ? { background: template.background } : undefined}>
      {thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : <LayoutTemplate size={16} />}
    </span>
    <span className="inspector-layout-text">
      <small>Layout preset</small>
      <strong id={nameId}>{name}</strong>
    </span>
    <span className="inspector-layout-action">Change<ChevronRight size={16} aria-hidden="true" /></span>
  </button>;
});

export const StudioCompositionPanel = memo(function StudioCompositionPanel(props: StudioCompositionPanelProps) {
  const [error, setError] = useState('');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const galleryTrigger = useRef<HTMLButtonElement>(null);
  const report = useCallback((result: ProjectMutationResult) => {
    setError(result.ok ? '' : result.error);
    return result;
  }, []);
  const { onPosterChange, onPhotosChange, onDecorationsChange } = props;
  const changePoster = useCallback((value: PosterSettings) => report(onPosterChange(value)), [onPosterChange, report]);
  const changePhotos = useCallback((value: PhotoSettings) => report(onPhotosChange(value)), [onPhotosChange, report]);
  const changeDecorations = useCallback((value: DecorationSettings) => report(onDecorationsChange(value)), [onDecorationsChange, report]);
  const openGallery = useCallback(() => setGalleryOpen(true), []);
  function closeGallery() {
    setGalleryOpen(false);
    window.setTimeout(() => galleryTrigger.current?.focus(), 0);
  }
  return <section className="studio-composition-panel" aria-label="Layout settings">
    {error && <p role="alert" className="studio-composition-error inspector-notice">{error}</p>}
    <Activity mode={galleryOpen ? 'hidden' : 'visible'}>
      <LayoutPresetEntry templateId={props.poster.templateId} isEnabled={props.poster.enabled} isDisabled={props.isDisabled}
        buttonRef={galleryTrigger} onOpen={openGallery} />
      {props.pageControls}
      <fieldset className="studio-composition-boundary" disabled={props.isDisabled}>
      <MapFrameControls silhouetteName={props.silhouetteName} cameraLocked={props.cameraLocked}
        onRectangle={props.onRectangle} onCreateSilhouette={props.onCreateSilhouette} />
      <InspectorAccordion title="Text" summary={textSummary(props.poster)}
        storageKey="print-map-studio:inspector:layout:text" isDefaultExpanded={false}>
        <PosterControls value={props.poster} epoch={props.documentEpoch} onChange={changePoster} />
      </InspectorAccordion>
      <InspectorAccordion title="Photos" summary={props.photos.stops.length === 1 ? '1 photo' : `${props.photos.stops.length} photos`} storageKey="print-map-studio:inspector:layout:photos" isDefaultExpanded={false}>
        <PhotoStoryControls value={props.photos} epoch={props.documentEpoch} pointLayers={props.pointLayers} onChange={changePhotos} onUpload={props.onPhotoUpload} onRemove={props.onPhotoRemove} />
      </InspectorAccordion>
      <InspectorAccordion title="Map elements" summary={decorationSummary(props.decorations)} storageKey="print-map-studio:inspector:layout:elements" isDefaultExpanded={false}>
        <DecorationControls value={props.decorations} epoch={props.documentEpoch} pointLayers={props.pointLayers} isFlat={props.isFlat} onChange={changeDecorations} />
      </InspectorAccordion>
      </fieldset>
    </Activity>
    {galleryOpen && <div className="inspector-template-subview">
      <button className="inspector-back" type="button" autoFocus onClick={closeGallery}><ArrowLeft aria-hidden="true" size={16} /> Back to Layout</button>
      <h3>Change layout</h3>
      <fieldset className="studio-composition-boundary" disabled={props.isDisabled}>
        <TemplateGallery mode="layout" selectedId={props.poster.enabled ? props.poster.templateId : undefined} onSelect={(id) => { if (report(props.onApplyTemplate(id)).ok) closeGallery(); }} />
      </fieldset>
    </div>}
  </section>;
});
