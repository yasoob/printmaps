import type { ReactNode } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { ReliefSettings } from '../../domain/studio';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { ToggleSection } from '@/components/ui/toggle-section';
import { PropertyRow } from './PropertyControls';
import { ValidatedNumberField } from './ValidatedNumberField';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { FeatureHelp } from './FeatureHelp';

export type ReliefControlsProps = {
  settings: ReliefSettings;
  layers: readonly ContentLayer[];
  documentEpoch: number;
  onChange: (settings: ReliefSettings) => ProjectMutationResult;
};

type ReliefSettingsControlsProps = ReliefControlsProps & { fitAction?: ReactNode };

export function ReliefSettingsControls({ settings, layers, documentEpoch, onChange, fitAction }: ReliefSettingsControlsProps) {
  const feedback = useMutationFeedback(settings);
  const commit = (value: ReliefSettings) => feedback.report(onChange(value));
  const numberProps = { resetKey: documentEpoch, step: 0.1 };
  const routes = layers.filter((layer) => layer.type === 'route' && layer.visible);
  const ridge = settings.routeRidge;
  return <>
    <PropertyRow label="Width"><ValidatedNumberField {...numberProps} label="Relief width" value={settings.widthMm} minimum={10} maximum={1000} unit="mm" onCommit={(widthMm) => onChange({ ...settings, widthMm, heightMm: settings.heightMm * widthMm / settings.widthMm })} /></PropertyRow>
    <PropertyRow label="Height"><ValidatedNumberField {...numberProps} label="Relief height" value={settings.heightMm} minimum={10} maximum={1000} unit="mm" onCommit={(heightMm) => onChange({ ...settings, heightMm, widthMm: settings.widthMm * heightMm / settings.heightMm })} /></PropertyRow>
    {fitAction && <div className="property-row relief-fit-row"><span aria-hidden="true" /><div className="property-control">{fitAction}</div></div>}
    <PropertyRow label="Base thickness"><ValidatedNumberField {...numberProps} label="Relief base thickness" value={settings.baseMm} minimum={0.2} maximum={100} unit="mm" onCommit={(baseMm) => onChange({ ...settings, baseMm })} /></PropertyRow>
    <PropertyRow label="Exaggeration (×)"><ValidatedNumberField {...numberProps} label="Relief exaggeration" value={settings.exaggeration} minimum={0.1} maximum={50} onCommit={(exaggeration) => onChange({ ...settings, exaggeration })} /></PropertyRow>
    <PropertyRow label="Detail"><select aria-label="Relief detail" value={settings.detail} onChange={(event) => commit({ ...settings, detail: event.target.value as ReliefSettings['detail'] })}><option value="low">Low · 64 samples</option><option value="medium">Medium · 128 samples</option><option value="high">High · 256 samples</option></select></PropertyRow>
    <ToggleSection title="Route ridge" switchLabel="Raise a route ridge" checked={ridge.enabled}
      help={<FeatureHelp label="Route ridge help">The ridge is fused into the terrain. Narrow ridges require higher detail or a smaller model; an unresolvable ridge blocks export.</FeatureHelp>}
      onCheckedChange={(enabled) => commit({ ...settings, routeRidge: { ...ridge, enabled, layerId: ridge.layerId ?? routes[0]?.id ?? null } })}>
      <PropertyRow label="Route"><select aria-label="Relief ridge route" value={ridge.layerId ?? ''} onChange={(event) => commit({ ...settings, routeRidge: { ...ridge, layerId: event.target.value || null } })}><option value="" disabled>Choose visible route</option>{routes.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></PropertyRow>
      <PropertyRow label="Ridge height"><ValidatedNumberField {...numberProps} label="Route ridge height" value={ridge.heightMm} minimum={0.1} maximum={20} unit="mm" onCommit={(heightMm) => onChange({ ...settings, routeRidge: { ...ridge, heightMm } })} /></PropertyRow>
      <PropertyRow label="Ridge width"><ValidatedNumberField {...numberProps} label="Route ridge width" value={ridge.widthMm} minimum={0.1} maximum={20} unit="mm" onCommit={(widthMm) => onChange({ ...settings, routeRidge: { ...ridge, widthMm } })} /></PropertyRow>
    </ToggleSection>
    {feedback.error && <p role="alert" className="coordinate-validation">{feedback.error}</p>}
  </>;
}
