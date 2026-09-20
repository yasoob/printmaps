import { useState } from 'react';
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
import './studioComposition.css';

export type StudioCompositionPanelProps = Readonly<{
  poster: PosterSettings; photos: PhotoSettings; decorations: DecorationSettings;
  pointLayers: readonly ContentLayer[]; documentEpoch: number; cameraLocked: boolean; isFlat: boolean;
  onPosterChange: (value: PosterSettings) => ProjectMutationResult;
  onPhotosChange: (value: PhotoSettings) => ProjectMutationResult;
  onDecorationsChange: (value: DecorationSettings) => ProjectMutationResult;
  onApplyTemplate: (id: PosterTemplate['id'], starter?: PosterStarter) => ProjectMutationResult;
  onCreateSilhouette: (area: AdministrativeArea) => ProjectMutationResult | Promise<ProjectMutationResult>;
  onPhotoUpload: PhotoUpload;
  onPhotoRemove: (id: string) => ProjectMutationResult;
  onOpenWall: () => void;
}>;

export function StudioCompositionPanel(props: StudioCompositionPanelProps) {
  const [error, setError] = useState('');
  const [isBoundaryPickerOpen, setBoundaryPickerOpen] = useState(false);
  const [isFitting, setFitting] = useState(false);
  function report(result: ProjectMutationResult) {
    setError(result.ok ? '' : result.error);
    return result;
  }
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
    <h3>Poster studio</h3>
    {error && <p role="alert" className="studio-composition-error">{error}</p>}
    <details><summary>Templates & starter gallery</summary><PosterGallery cameraLocked={props.cameraLocked} onApply={(id, starter) => report(props.onApplyTemplate(id, starter))} /></details>
    <details><summary>Poster typography & paper</summary><PosterControls value={props.poster} epoch={props.documentEpoch} onChange={(value) => report(props.onPosterChange(value))} /></details>
    <details><summary>Country & region silhouette</summary>
      <p>Fill an administrative outline with the current map. Islands and holes are kept. A previous poster silhouette is hidden, not deleted; locked silhouettes must be unlocked first. Other layers are kept.</p>
      <button type="button" disabled={props.cameraLocked || isFitting} onClick={() => setBoundaryPickerOpen(true)}>Choose country or region</button>
      {props.cameraLocked && <p role="status">Unlock the map area to fit a silhouette.</p>}
      {isFitting && <p role="status">Fitting boundary...</p>}
      {isBoundaryPickerOpen && !isFitting && <AdministrativeAreaPicker onAdd={(area) => void createSilhouette(area)} onCancel={() => setBoundaryPickerOpen(false)} />}
    </details>
    <details><summary>Photo story</summary><PhotoStoryControls value={props.photos} epoch={props.documentEpoch} pointLayers={props.pointLayers} onChange={(value) => report(props.onPhotosChange(value))} onUpload={props.onPhotoUpload} onRemove={props.onPhotoRemove} /></details>
    <details><summary>Compass, scale, grid & QR</summary><DecorationControls value={props.decorations} epoch={props.documentEpoch} pointLayers={props.pointLayers} isFlat={props.isFlat} onChange={(value) => report(props.onDecorationsChange(value))} /></details>
    <button type="button" onClick={props.onOpenWall}>Preview on a wall</button>
    <p className="studio-composition-note">Poster artwork is included in PNG, SVG, PDF, and PSD. Map attribution always stays visible. PDF typography supports Latin text; use SVG or PNG for other scripts.</p>
  </section>;
}
