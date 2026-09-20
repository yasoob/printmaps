import { Activity, memo, useCallback, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { AdministrativeArea } from '../../domain/administrativeAreas';
import type { ContentLayer } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { DecorationSettings, PhotoSettings, PosterSettings } from '../../domain/studio';
import type { PosterTemplate } from '../../domain/studioTemplates';
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
  function closeGallery() {
    setGalleryOpen(false);
    window.setTimeout(() => galleryTrigger.current?.focus(), 0);
  }
  return <section className="studio-composition-panel" aria-label="Layout settings">
    {error && <p role="alert" className="studio-composition-error inspector-notice">{error}</p>}
    <Activity mode={galleryOpen ? 'hidden' : 'visible'}>
      <button ref={galleryTrigger} className="inspector-layout-entry" type="button" disabled={props.isDisabled} onClick={() => setGalleryOpen(true)}>
        <span>Change layout</span><ChevronRight size={16} aria-hidden="true" />
      </button>
      {props.pageControls}
      <fieldset className="studio-composition-boundary" disabled={props.isDisabled}>
      <MapFrameControls silhouetteName={props.silhouetteName} cameraLocked={props.cameraLocked}
        onRectangle={props.onRectangle} onCreateSilhouette={props.onCreateSilhouette} />
      <InspectorAccordion title="Text" summary={props.poster.enabled ? props.poster.title.text || 'Title, subtitle & caption' : 'Title, subtitle, caption & coordinates'}
        storageKey="print-map-studio:inspector:layout:text" isDefaultExpanded={false}>
        <PosterControls value={props.poster} epoch={props.documentEpoch} onChange={changePoster} />
      </InspectorAccordion>
      <InspectorAccordion title="Photos" summary={`${props.photos.stops.length} attached`} storageKey="print-map-studio:inspector:layout:photos" isDefaultExpanded={false}>
        <PhotoStoryControls value={props.photos} epoch={props.documentEpoch} pointLayers={props.pointLayers} onChange={changePhotos} onUpload={props.onPhotoUpload} onRemove={props.onPhotoRemove} />
      </InspectorAccordion>
      <InspectorAccordion title="Map elements" summary="Compass, scale, grid & QR" storageKey="print-map-studio:inspector:layout:elements" isDefaultExpanded={false}>
        <DecorationControls value={props.decorations} epoch={props.documentEpoch} pointLayers={props.pointLayers} isFlat={props.isFlat} onChange={changeDecorations} />
      </InspectorAccordion>
      </fieldset>
    </Activity>
    {galleryOpen && <div className="inspector-template-subview">
      <button className="inspector-back" type="button" autoFocus onClick={closeGallery}><ArrowLeft aria-hidden="true" size={16} /> Back to Layout</button>
      <h3>Change layout</h3>
      <fieldset className="studio-composition-boundary" disabled={props.isDisabled}>
        <TemplateGallery mode="layout" onSelect={(id) => { if (report(props.onApplyTemplate(id)).ok) closeGallery(); }} />
      </fieldset>
    </div>}
  </section>;
});
