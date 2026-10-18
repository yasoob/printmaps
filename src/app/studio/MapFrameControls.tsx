import { memo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { AdministrativeArea } from '../../domain/administrativeAreas';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { AdministrativeAreaPicker } from '../components/AdministrativeAreaPicker';
import { InspectorAccordion } from '../components/PropertyControls';
import { FeatureHelp } from '../components/FeatureHelp';
import { SegmentedControl } from '../../components/ui/segmented-control';
import { Notice } from '../../components/ui/notice';

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
  function selectShape(shape: 'rectangle' | 'outline') {
    if (shape === 'outline') {
      setPickerOpen(true);
      return;
    }
    const result = onRectangle();
    setError(result.ok ? '' : result.error);
    if (result.ok) setPickerOpen(false);
  }
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
    <SegmentedControl className="inspector-frame-options" label="Map frame shape" value={hasOutline ? 'outline' : 'rectangle'}
      options={[{ value: 'rectangle', label: 'Rectangle' }, { value: 'outline', label: 'Country / region', disabled: cameraLocked || isFitting }]}
      onValueChange={selectShape} />
    {silhouetteName && <div className="feature-help-row inspector-frame-current"><span>{silhouetteName}</span>
      <FeatureHelp label="Map frame help">Rectangle hides the current outline without deleting it. Undo restores the previous frame.</FeatureHelp>
    </div>}
    {cameraLocked && <Notice tone="info" className="studio-composition-notice">Unlock the map area in <span className="inline-breadcrumb">Map<ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} /><span className="sr-only">, </span>View</span> to fit a boundary.</Notice>}
    {isFitting && <p role="status" className="property-note">Fitting boundary…</p>}
    {error && <Notice tone="error" className="studio-composition-notice">{error}</Notice>}
    {pickerOpen && !isFitting && <AdministrativeAreaPicker onAdd={(area) => void createSilhouette(area)} onCancel={() => setPickerOpen(false)} />}
  </InspectorAccordion>;
});
