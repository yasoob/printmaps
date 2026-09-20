import { memo, useState } from 'react';
import type { AdministrativeArea } from '../../domain/administrativeAreas';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { AdministrativeAreaPicker } from '../components/AdministrativeAreaPicker';
import { InspectorAccordion } from '../components/PropertyControls';
import { FeatureHelp } from '../components/FeatureHelp';

export const MapFrameControls = memo(function MapFrameControls({ silhouetteName, cameraLocked, onRectangle, onCreateSilhouette }: {
  silhouetteName: string | null;
  cameraLocked: boolean;
  onRectangle: () => ProjectMutationResult;
  onCreateSilhouette: (area: AdministrativeArea) => ProjectMutationResult | Promise<ProjectMutationResult>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isFitting, setFitting] = useState(false);
  const [error, setError] = useState('');
  const hasOutline = pickerOpen || Boolean(silhouetteName);
  async function createSilhouette(area: AdministrativeArea) {
    setFitting(true);
    try {
      const result = await onCreateSilhouette(area);
      setError(result.ok ? '' : result.error);
      if (result.ok) setPickerOpen(false);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'The boundary could not be fitted.');
    } finally {
      setFitting(false);
    }
  }
  return <InspectorAccordion title="Map frame" summary={silhouetteName ?? 'Rectangle'} storageKey="print-map-studio:inspector:layout:frame" isDefaultExpanded={false}>
    <div className="segmented inspector-frame-options">
      <button type="button" aria-pressed={!hasOutline} className={hasOutline ? undefined : 'is-active'} onClick={() => {
        const result = onRectangle();
        setError(result.ok ? '' : result.error);
        if (result.ok) setPickerOpen(false);
      }}>Rectangle</button>
      <button type="button" aria-pressed={hasOutline} className={hasOutline ? 'is-active' : undefined}
        disabled={cameraLocked || isFitting} onClick={() => setPickerOpen(true)}>Country / region</button>
    </div>
    {silhouetteName && <div className="feature-help-row inspector-frame-current"><span>{silhouetteName}</span>
      <FeatureHelp label="Map frame help">Rectangle hides the current outline without deleting it. Undo restores the previous frame.</FeatureHelp>
    </div>}
    {cameraLocked && <p className="property-note" role="status">Unlock the map area to fit a boundary.</p>}
    {isFitting && <p role="status" className="property-note">Fitting boundary...</p>}
    {error && <p role="alert" className="coordinate-validation">{error}</p>}
    {pickerOpen && !isFitting && <AdministrativeAreaPicker onAdd={(area) => void createSilhouette(area)} onCancel={() => setPickerOpen(false)} />}
  </InspectorAccordion>;
});
