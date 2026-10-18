import { ArrowLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import {
  isMapStyleCustomized,
  resolveMapStyleTokens,
  type MapStyleCustomization,
  type MapStyleTone,
} from '../../domain/mapStyleCustomization';
import { MAP_STYLE_TOKEN_ROLES, type MapStylePreset, type MapStyleTokenRole } from '../../domain/mapStylePresets';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { Button } from '../../components/ui/button';
import { ColorField } from '../../components/ui/color-field';
import { SegmentedControl } from '../../components/ui/segmented-control';

type EditMode = 'history' | 'amend';

const TOKEN_LABELS: Record<MapStyleTokenRole, string> = {
  canvas: 'Canvas',
  land: 'Land',
  water: 'Water',
  park: 'Parks',
  building: 'Buildings',
  majorRoad: 'Major roads',
  minorRoad: 'Minor roads',
  boundary: 'Boundaries',
  transit: 'Transit',
  label: 'Labels',
  labelHalo: 'Label halo',
};

// Roles that differ visibly across presets; near-white land/road tones vanish on the trigger fill.
const PREVIEW_ROLES = ['water', 'park', 'boundary', 'label'] as const;
const TONES = [{ value: 'cool', label: 'Cool' }, { value: 'balanced', label: 'Balanced' }, { value: 'warm', label: 'Warm' }] as const;

type CustomizationActions = {
  onAdjustmentChange: (adjustment: 'contrast' | 'detail', value: number, mode?: EditMode) => ProjectMutationResult;
  onColorChange: (role: MapStyleTokenRole, color: string | null, mode?: EditMode) => ProjectMutationResult;
  onReset: () => ProjectMutationResult;
  onToneChange: (tone: MapStyleTone) => ProjectMutationResult;
};

type MapStyleCustomizerProps = CustomizationActions & {
  customization: MapStyleCustomization;
  onBack: () => void;
  onResetMapStyle: () => ProjectMutationResult;
  preset: MapStylePreset;
};

function AdjustmentRange({
  customization,
  label,
  value,
  low,
  high,
  onChange,
}: {
  customization: MapStyleCustomization;
  label: string;
  value: number;
  low: string;
  high: string;
  onChange: (value: number, mode: EditMode) => ProjectMutationResult;
}) {
  const isEditing = useRef(false);
  const feedback = useMutationFeedback(customization);
  const finish = () => { isEditing.current = false; };
  return (
    <label className="map-style-adjustment">
      <span><strong>{label}</strong><output>{value}%</output></span>
      <input
        aria-label={label}
        max="100"
        min="0"
        step="1"
        type="range"
        value={value}
        onBlur={finish}
        onChange={(event) => {
          const result = feedback.report(onChange(event.currentTarget.valueAsNumber, isEditing.current ? 'amend' : 'history'));
          if (result.ok && result.changed !== false) isEditing.current = true;
        }}
        onPointerUp={finish}
      />
      <small><span>{low}</span><span>{high}</span></small>
      {feedback.error && <small className="coordinate-validation" role="alert">{feedback.error}</small>}
    </label>
  );
}

function SemanticColorRow({
  customization,
  color,
  customColor,
  label,
  role,
  onChange,
}: {
  customization: MapStyleCustomization;
  color: string;
  customColor?: string;
  label: string;
  role: MapStyleTokenRole;
  onChange: CustomizationActions['onColorChange'];
}) {
  const isEditing = useRef(false);
  const feedback = useMutationFeedback(customization);
  const finish = () => { isEditing.current = false; };
  return (
    <div className="map-style-color-row">
      <span title={customColor ? `${label} · Custom color` : label}>
        <span className="map-style-color-label">{label}</span>
        {customColor ? <small className="is-custom"><span aria-hidden="true" /><span className="sr-only">Custom</span></small> : null}
      </span>
      <ColorField
        label={`${label} color`}
        value={color}
        onBlur={finish}
        onPointerDown={finish}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') finish();
        }}
        onChange={(value) => {
          const result = feedback.report(onChange(role, value, isEditing.current ? 'amend' : 'history'));
          if (result.ok && result.changed !== false) isEditing.current = true;
        }}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Reset ${label} color`}
        disabled={!customColor}
        title={customColor ? `Reset ${label} to Quick Tune` : `${label} follows Quick Tune`}
        onClick={() => feedback.report(onChange(role, null))}
      >
        <RotateCcw aria-hidden="true" />
      </Button>
      {feedback.error && <small className="coordinate-validation" role="alert">{feedback.error}</small>}
    </div>
  );
}

export function MapStyleCustomizeTrigger({
  buttonRef,
  customization,
  onOpen,
  preset,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  customization: MapStyleCustomization;
  onOpen: () => void;
  preset: MapStylePreset;
}) {
  const tokens = resolveMapStyleTokens(preset, customization);
  const customized = isMapStyleCustomized(customization);
  return (
    <button ref={buttonRef} className="map-style-customize-trigger" type="button" onClick={onOpen}>
      <span className="map-style-customize-swatches" aria-hidden="true">
        {PREVIEW_ROLES.map((role) => <i key={role} style={{ background: tokens[role] }} />)}
      </span>
      <span>
        <strong>{customized ? 'Edit custom palette' : 'Customize colors'}</strong>
      </span>
      {customized ? <em>Custom</em> : null}
      <ChevronRight aria-hidden="true" size={15} />
    </button>
  );
}

export function MapStyleCustomizer({
  customization,
  onAdjustmentChange,
  onBack,
  onColorChange,
  onReset,
  onResetMapStyle,
  onToneChange,
  preset,
}: MapStyleCustomizerProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tokens = resolveMapStyleTokens(preset, customization);
  const customized = isMapStyleCustomized(customization);
  const feedback = useMutationFeedback(customization);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <div className="properties-panel map-style-customizer inspector-subview is-forward" onKeyDown={(event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onBack();
    }}>
      <header className="map-style-customizer-header">
        <Button variant="ghost" size="icon" aria-label="Back to project properties" onClick={onBack}><ArrowLeft aria-hidden="true" /></Button>
        <h2 ref={headingRef} tabIndex={-1}>Customize map</h2>
        <Button
          variant="ghost"
          size="sm"
          className="map-style-reset"
          aria-label="Reset to Paper"
          disabled={preset === 'paper' && !customized}
          onClick={() => feedback.report(onResetMapStyle())}
        >
          <span className="map-style-reset-wide">Reset to Paper</span>
          <span className="map-style-reset-narrow">Reset map</span>
        </Button>
      </header>
      <div className="map-style-customizer-content">
        <section>
          <SegmentedControl label="Map tone" value={customization.tone} options={TONES} onValueChange={(tone) => feedback.report(onToneChange(tone))} />
          <AdjustmentRange customization={customization} label="Contrast" value={customization.contrast} low="Soft" high="Crisp" onChange={(value, mode) => onAdjustmentChange('contrast', value, mode)} />
          <AdjustmentRange customization={customization} label="Detail" value={customization.detail} low="Quiet" high="Rich" onChange={(value, mode) => onAdjustmentChange('detail', value, mode)} />
          {customized && <div className="map-style-clear-tuning">
            <Button variant="link" size="sm" onClick={() => feedback.report(onReset())}>Clear tuning and overrides</Button>
          </div>}
          {feedback.error && <p className="coordinate-validation" role="alert">{feedback.error}</p>}
        </section>
        <section>
          <div className="map-style-color-list">
            {MAP_STYLE_TOKEN_ROLES.map((role) => (
              <SemanticColorRow
                key={role}
                customization={customization}
                color={tokens[role]}
                customColor={customization.colors[role]}
                label={TOKEN_LABELS[role]}
                role={role}
                onChange={onColorChange}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
