import { memo, useCallback, useState } from 'react';
import type { AdministrativeArea } from '../../domain/administrativeAreas';
import type { ContentLayer } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { DecorationSettings, PhotoSettings, PosterSettings } from '../../domain/studio';
import type { PosterStarter, PosterTemplate } from '../../domain/studioTemplates';
import { AdministrativeAreaPicker } from '../components/AdministrativeAreaPicker';
import { DecorationControls } from './DecorationControls';
import { PhotoStoryControls, type PhotoUpload } from './PhotoStoryControls';
import { PosterControls } from './PosterControls';
import { PosterGallery } from './PosterGallery';
import { FeatureHelp } from '../components/FeatureHelp';
import './studioComposition.css';

export type StudioCompositionPanelProps = Readonly<{
  poster: PosterSettings; photos: PhotoSettings; decorations: DecorationSettings;
  pointLayers: readonly Pick<ContentLayer, 'id' | 'name'>[]; documentEpoch: number; cameraLocked: boolean; isFlat: boolean;
  onPosterChange: (value: PosterSettings) => ProjectMutationResult;
  onPhotosChange: (value: PhotoSettings) => ProjectMutationResult;
  onDecorationsChange: (value: DecorationSettings) => ProjectMutationResult;
  onApplyTemplate: (id: PosterTemplate['id'], starter?: PosterStarter) => ProjectMutationResult;
  onCreateSilhouette: (area: AdministrativeArea) => ProjectMutationResult | Promise<ProjectMutationResult>;
  onPhotoUpload: PhotoUpload;
  onPhotoRemove: (id: string) => ProjectMutationResult;
  onOpenWall: () => void;
}>;

export const StudioCompositionPanel = memo(function StudioCompositionPanel(props: StudioCompositionPanelProps) {
  const [error, setError] = useState('');
  const [isBoundaryPickerOpen, setBoundaryPickerOpen] = useState(false);
  const [isFitting, setFitting] = useState(false);
  const report = useCallback((result: ProjectMutationResult) => {
    setError(result.ok ? '' : result.error);
    return result;
  }, []);
  const { onApplyTemplate, onPosterChange, onPhotosChange, onDecorationsChange } = props;
  const applyTemplate = useCallback<StudioCompositionPanelProps['onApplyTemplate']>((id, starter) => report(onApplyTemplate(id, starter)), [onApplyTemplate, report]);
  const changePoster = useCallback((value: PosterSettings) => report(onPosterChange(value)), [onPosterChange, report]);
  const changePhotos = useCallback((value: PhotoSettings) => report(onPhotosChange(value)), [onPhotosChange, report]);
  const changeDecorations = useCallback((value: DecorationSettings) => report(onDecorationsChange(value)), [onDecorationsChange, report]);
  async function createSilhouette(area: AdministrativeArea) {
    setFitting(true);
    try {
      const result = await props.onCreateSilhouette(area);
      report(result);
      if (result.ok) setBoundaryPickerOpen(false);
    } catch (fitError) {
      setError(fitError instanceof Error ? fitError.message : 'The boundary could not be fitted.');
    } finally {
      setFitting(false);
    }
  }
  return <section className="studio-composition-panel" aria-label="Poster composition">
    <div className="feature-help-row"><h3>Poster studio</h3><FeatureHelp label="Poster artwork export help">Poster artwork is included in PNG, SVG, PDF, and PSD. Map attribution stays visible. PDF typography supports Latin text; use SVG or PNG for other scripts.</FeatureHelp></div>
    {error && <p role="alert" className="studio-composition-error">{error}</p>}
    <details><summary>Templates & starter gallery</summary><PosterGallery cameraLocked={props.cameraLocked} onApply={applyTemplate} /></details>
    <details><summary>Poster typography & paper</summary><PosterControls value={props.poster} epoch={props.documentEpoch} onChange={changePoster} /></details>
    <details><summary>Country & region silhouette</summary>
      <div className="feature-help-row">
        <button type="button" disabled={props.cameraLocked || isFitting} onClick={() => setBoundaryPickerOpen(true)}>Choose country or region</button>
        <FeatureHelp label="Country and region silhouette help">Fill an administrative outline with the current map, keeping islands and holes. A previous silhouette is hidden, not deleted; unlock locked silhouettes first. Other layers are kept.</FeatureHelp>
      </div>
      {props.cameraLocked && <p role="status">Unlock the map area to fit a silhouette.</p>}
      {isFitting && <p role="status">Fitting boundary...</p>}
      {isBoundaryPickerOpen && !isFitting && <AdministrativeAreaPicker onAdd={(area) => void createSilhouette(area)} onCancel={() => setBoundaryPickerOpen(false)} />}
    </details>
    <details><summary>Photo story</summary><PhotoStoryControls value={props.photos} epoch={props.documentEpoch} pointLayers={props.pointLayers} onChange={changePhotos} onUpload={props.onPhotoUpload} onRemove={props.onPhotoRemove} /></details>
    <details><summary>Compass, scale, grid & QR</summary><DecorationControls value={props.decorations} epoch={props.documentEpoch} pointLayers={props.pointLayers} isFlat={props.isFlat} onChange={changeDecorations} /></details>
    <button type="button" onClick={props.onOpenWall}>Preview on a wall</button>
  </section>;
});
