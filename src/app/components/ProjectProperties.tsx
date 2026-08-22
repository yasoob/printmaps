import { useRef, useState } from 'react';
import type { CameraSettings, PageSettings, StandardPagePreset } from '../../domain/project';
import { NumberField, PropertyRow, PropertySection } from './PropertyControls';

function isValidPageDimension(draft: string) {
  const value = Number(draft);
  return draft.trim() !== '' && Number.isFinite(value) && value > 0;
}

type PageDimensionFieldProps = {
  label: string;
  ariaLabel: string;
  dimension: 'widthMm' | 'heightMm';
  value: number;
  onCommit: (dimension: 'widthMm' | 'heightMm', value: number) => void;
};

function PageDimensionField({ label, ariaLabel, dimension, value, onCommit }: PageDimensionFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const dirtyRef = useRef(false);
  const commit = () => {
    if (!dirtyRef.current) return;
    if (!isValidPageDimension(draft)) {
      setDraft(String(value));
      dirtyRef.current = false;
      return;
    }
    const nextValue = Number(draft);
    setDraft(String(nextValue));
    dirtyRef.current = false;
    onCommit(dimension, nextValue);
  };

  return (
    <label>
      <span>{label}</span>
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        value={draft}
        aria-invalid={!isValidPageDimension(draft)}
        onChange={(event) => {
          setDraft(event.target.value);
          dirtyRef.current = true;
        }}
        onBlur={commit}
      />
      <small>mm</small>
    </label>
  );
}

type CameraFieldProps = {
  field: keyof CameraSettings;
  value: number;
  onCommit: (value: number) => void;
};

function isValidCameraDraft(field: keyof CameraSettings, draft: string) {
  const value = Number(draft);
  const [minimum, maximum] = field === 'bearing' ? [-180, 180] : [0, 60];
  return draft.trim() !== '' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function CameraField({ field, value, onCommit }: CameraFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const dirtyRef = useRef(false);
  const commit = () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    if (!isValidCameraDraft(field, draft)) {
      setDraft(String(value));
      return;
    }
    const nextValue = Number(draft);
    setDraft(String(nextValue));
    onCommit(nextValue);
  };

  return (
    <label className="number-field">
      <input
        aria-label={field === 'bearing' ? 'Bearing' : 'Pitch'}
        aria-invalid={!isValidCameraDraft(field, draft)}
        inputMode="decimal"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          dirtyRef.current = true;
        }}
        onBlur={commit}
      />
      <small>°</small>
    </label>
  );
}

type ProjectPropertiesProps = {
  page: PageSettings;
  camera: CameraSettings;
  onBearingChange: (bearing: number) => void;
  onDimensionChange: (dimension: 'widthMm' | 'heightMm', value: number) => void;
  onOrientationChange: (orientation: PageSettings['orientation']) => void;
  onPitchChange: (pitch: number) => void;
  onPresetChange: (preset: StandardPagePreset) => void;
};

export function ProjectProperties({
  camera,
  onBearingChange,
  page,
  onDimensionChange,
  onOrientationChange,
  onPitchChange,
  onPresetChange,
}: ProjectPropertiesProps) {
  return (
    <div className="properties-panel">
      <div className="properties-title"><div><span className="eyebrow">Properties</span><h2 data-project-heading tabIndex={-1}>Project</h2></div><button className="icon-button" type="button" aria-label="Project menu">•••</button></div>
      <PropertySection title="Page">
        <PropertyRow label="Preset"><select aria-label="Page preset" value={page.preset} onChange={(event) => onPresetChange(event.target.value as StandardPagePreset)}><option>A4</option><option>A3</option><option>Letter</option><option disabled>Custom</option></select></PropertyRow>
        <div className="paired-fields">
          <PageDimensionField key={`width-${page.widthMm}-${page.preset}`} label="W" ariaLabel="Page width" dimension="widthMm" value={page.widthMm} onCommit={onDimensionChange} />
          <PageDimensionField key={`height-${page.heightMm}-${page.preset}`} label="H" ariaLabel="Page height" dimension="heightMm" value={page.heightMm} onCommit={onDimensionChange} />
        </div>
        <PropertyRow label="Orientation"><div className="segmented"><button className={page.orientation === 'landscape' ? 'is-active' : undefined} type="button" aria-pressed={page.orientation === 'landscape'} onClick={() => onOrientationChange('landscape')}>Landscape</button><button className={page.orientation === 'portrait' ? 'is-active' : undefined} type="button" aria-pressed={page.orientation === 'portrait'} onClick={() => onOrientationChange('portrait')}>Portrait</button></div></PropertyRow>
      </PropertySection>
      <PropertySection title="Map">
        <PropertyRow label="Style"><select aria-label="Map style" defaultValue="Liberty"><option>Liberty</option><option>Positron</option><option>Dark</option></select></PropertyRow>
        <PropertyRow label="Bearing"><CameraField key={`bearing-${camera.bearing}`} field="bearing" value={camera.bearing} onCommit={onBearingChange} /></PropertyRow>
        <PropertyRow label="Pitch"><CameraField key={`pitch-${camera.pitch}`} field="pitch" value={camera.pitch} onCommit={onPitchChange} /></PropertyRow>
        <PropertyRow label="Text scale"><NumberField value="100" suffix="%" ariaLabel="Text scale" /></PropertyRow>
      </PropertySection>
      <PropertySection title="Export">
        <PropertyRow label="Resolution"><select aria-label="Export resolution" value="Browser preview" disabled><option>Browser preview</option></select></PropertyRow>
        <label className="check-row"><input type="checkbox" checked disabled readOnly /> Include map attribution</label>
      </PropertySection>
    </div>
  );
}
