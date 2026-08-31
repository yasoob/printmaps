import { ArrowLeft, ChevronRight, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import {
  isMapStyleCustomized,
  resolveMapStyleTokens,
  type MapStyleCustomization,
  type MapStyleTone,
} from '../../domain/mapStyleCustomization';
import {
  MAP_STYLE_PRESETS,
  MAP_STYLE_TOKEN_ROLES,
  type MapStylePreset,
  type MapStyleTokenRole,
} from '../../domain/mapStylePresets';

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

const PREVIEW_ROLES = ['land', 'water', 'park', 'majorRoad', 'label'] as const;

type CustomizationActions = {
  onAdjustmentChange: (adjustment: 'contrast' | 'detail', value: number, mode?: EditMode) => void;
  onColorChange: (role: MapStyleTokenRole, color: string | null, mode?: EditMode) => void;
  onReset: () => void;
  onToneChange: (tone: MapStyleTone) => void;
};

type MapStyleCustomizerProps = CustomizationActions & {
  customization: MapStyleCustomization;
  onBack: () => void;
  onResetMapStyle: () => void;
  preset: MapStylePreset;
};

function AdjustmentRange({
  label,
  value,
  low,
  high,
  onChange,
}: {
  label: string;
  value: number;
  low: string;
  high: string;
  onChange: (value: number, mode: EditMode) => void;
}) {
  const isEditing = useRef(false);
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
          onChange(event.currentTarget.valueAsNumber, isEditing.current ? 'amend' : 'history');
          isEditing.current = true;
        }}
        onPointerUp={finish}
      />
      <small><span>{low}</span><span>{high}</span></small>
    </label>
  );
}

function SemanticColorRow({
  color,
  customColor,
  label,
  role,
  onChange,
}: {
  color: string;
  customColor?: string;
  label: string;
  role: MapStyleTokenRole;
  onChange: CustomizationActions['onColorChange'];
}) {
  const isEditing = useRef(false);
  const finish = () => { isEditing.current = false; };
  return (
    <div className="map-style-color-row">
      <span>{label}<small className={customColor ? 'is-custom' : undefined}>{customColor ? 'Custom' : 'Linked'}</small></span>
      <input
        aria-label={`${label} color`}
        type="color"
        value={color}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') finish();
        }}
        onPointerDown={finish}
        onInput={(event) => {
          onChange(role, event.currentTarget.value, isEditing.current ? 'amend' : 'history');
          isEditing.current = true;
        }}
      />
      <code>{color.toUpperCase()}</code>
      <button
        aria-label={`Reset ${label} color`}
        disabled={!customColor}
        title={customColor ? `Reset ${label} to Quick Tune` : `${label} follows Quick Tune`}
        type="button"
        onClick={() => onChange(role, null)}
      >
        <RotateCcw aria-hidden="true" size={12} />
      </button>
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
  const definition = MAP_STYLE_PRESETS.find(({ id }) => id === preset) ?? MAP_STYLE_PRESETS[0];
  const tokens = resolveMapStyleTokens(preset, customization);
  const customized = isMapStyleCustomized(customization);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <div className="properties-panel map-style-customizer inspector-subview is-forward" onKeyDown={(event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onBack();
    }}>
      <header className="map-style-customizer-header">
        <button className="icon-button" aria-label="Back to project properties" type="button" onClick={onBack}><ArrowLeft size={17} /></button>
        <span><h2 ref={headingRef} tabIndex={-1}>Customize map</h2><small>{definition.label} base</small></span>
        <button
          className="map-style-reset"
          aria-label="Reset to Paper"
          disabled={preset === 'paper' && !customized}
          type="button"
          onClick={onResetMapStyle}
        >
          <span className="map-style-reset-wide">Reset to Paper</span>
          <span className="map-style-reset-narrow">Reset map</span>
        </button>
      </header>
      <div className="map-style-customizer-content">
        <section>
          <div className="map-style-customizer-section-heading">
            <span><SlidersHorizontal size={14} /><h3>Quick Tune</h3></span>
            <div className="map-style-customizer-palette" aria-label="Resolved map palette">
              {PREVIEW_ROLES.map((role) => <i key={role} style={{ background: tokens[role] }} />)}
            </div>
          </div>
          <p>Set the overall direction first. Linked colors below follow these adjustments.</p>
          <div className="map-style-tone" role="group" aria-label="Map tone">
            {(['cool', 'balanced', 'warm'] as const).map((tone) => (
              <button key={tone} aria-pressed={customization.tone === tone} type="button" onClick={() => onToneChange(tone)}>
                {tone[0]!.toUpperCase()}{tone.slice(1)}
              </button>
            ))}
          </div>
          <AdjustmentRange label="Contrast" value={customization.contrast} low="Soft" high="Crisp" onChange={(value, mode) => onAdjustmentChange('contrast', value, mode)} />
          <AdjustmentRange label="Detail" value={customization.detail} low="Quiet" high="Rich" onChange={(value, mode) => onAdjustmentChange('detail', value, mode)} />
          <button className="map-style-clear-tuning" disabled={!customized} type="button" onClick={onReset}>Clear tuning and overrides</button>
        </section>
        <section>
          <div className="map-style-color-list">
            {MAP_STYLE_TOKEN_ROLES.map((role) => (
              <SemanticColorRow
                key={role}
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
