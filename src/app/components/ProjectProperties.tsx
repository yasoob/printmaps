import { useRef, useState } from 'react';
import type { CameraSettings, MapFeatureVisibilityCategory, MapLanguage, MapStylePreset, MapStyleSettings, PageSettings, StandardPagePreset } from '../../domain/project';
import { MapboxServiceStatus } from './MapboxServiceStatus';
import { InspectorAccordion, PropertyRow } from './PropertyControls';
import { GeolocationControl } from './GeolocationControl';
import { Checkbox, Switch } from './UiControls';
import { MAP_STYLE_PRESET_LABELS } from '../../domain/mapStylePresets';
import { MapStyleGallery } from './MapStyleGallery';

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
  field: 'bearing' | 'pitch';
  value: number;
  onCommit: (value: number) => void;
};

function isValidCameraDraft(field: CameraFieldProps['field'], draft: string) {
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

function TextScaleField({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const dirtyRef = useRef(false);
  const isValid = draft.trim() !== '' && Number.isFinite(Number(draft)) && Number(draft) >= 50 && Number(draft) <= 200;
  const commit = () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    if (!isValid) {
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
        aria-label="Text scale"
        aria-invalid={!isValid}
        inputMode="decimal"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          dirtyRef.current = true;
        }}
        onBlur={commit}
      />
      <small>%</small>
    </label>
  );
}

type ProjectPropertiesProps = {
  documentEpoch: number;
  page: PageSettings;
  camera: CameraSettings;
  style: MapStyleSettings;
  onBearingChange: (bearing: number) => void;
  onDimensionChange: (dimension: 'widthMm' | 'heightMm', value: number) => void;
  onFeatureVisibilityChange: (category: MapFeatureVisibilityCategory, isVisible: boolean) => void;
  onLanguageChange: (language: MapLanguage) => void;
  onLocate: (coordinate: [number, number], onApplied: () => void) => void;
  onMapAreaLockChange: (isLocked: boolean) => void;
  onOrientationChange: (orientation: PageSettings['orientation']) => void;
  onPitchChange: (pitch: number) => void;
  onPresetChange: (preset: StandardPagePreset) => void;
  onStyleChange: (preset: MapStylePreset) => void;
  onTextScaleChange: (textScalePercent: number) => void;
};

const PROJECT_DISCLOSURE_PREFIX = 'print-map-studio:inspector:project';

const MAP_LANGUAGE_LABELS: Record<MapLanguage, string> = {
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  local: 'Local names',
  zh: 'Chinese',
};

export function ProjectProperties({
  camera,
  documentEpoch,
  style,
  onBearingChange,
  page,
  onDimensionChange,
  onFeatureVisibilityChange,
  onLanguageChange,
  onLocate,
  onMapAreaLockChange,
  onOrientationChange,
  onPitchChange,
  onPresetChange,
  onStyleChange,
  onTextScaleChange,
}: ProjectPropertiesProps) {
  const visibleMapDetailCount = Object.values(style.visibility).filter(Boolean).length;
  return (
    <div className="properties-panel">
      <div className="properties-title"><h2 data-project-heading tabIndex={-1}>Project</h2></div>
      <InspectorAccordion isDefaultExpanded storageKey={`${PROJECT_DISCLOSURE_PREFIX}:page`} summary={`${page.preset} ${page.orientation} · ${page.widthMm} × ${page.heightMm} mm`} title="Page">
        <PropertyRow label="Preset"><select aria-label="Page preset" value={page.preset} onChange={(event) => onPresetChange(event.target.value as StandardPagePreset)}><option>A4</option><option>A3</option><option>Letter</option><option disabled>Custom</option></select></PropertyRow>
        <div className="paired-fields">
          <PageDimensionField key={`width-${page.widthMm}-${page.preset}`} label="W" ariaLabel="Page width" dimension="widthMm" value={page.widthMm} onCommit={onDimensionChange} />
          <PageDimensionField key={`height-${page.heightMm}-${page.preset}`} label="H" ariaLabel="Page height" dimension="heightMm" value={page.heightMm} onCommit={onDimensionChange} />
        </div>
        <PropertyRow label="Orientation"><div className="segmented"><button className={page.orientation === 'landscape' ? 'is-active' : undefined} type="button" aria-pressed={page.orientation === 'landscape'} onClick={() => onOrientationChange('landscape')}>Landscape</button><button className={page.orientation === 'portrait' ? 'is-active' : undefined} type="button" aria-pressed={page.orientation === 'portrait'} onClick={() => onOrientationChange('portrait')}>Portrait</button></div></PropertyRow>
      </InspectorAccordion>
      <InspectorAccordion isDefaultExpanded storageKey={`${PROJECT_DISCLOSURE_PREFIX}:map-style`} summary={`${MAP_STYLE_PRESET_LABELS[style.preset]} · ${MAP_LANGUAGE_LABELS[style.language]} · ${style.textScalePercent}%`} title="Map style">
        <MapStyleGallery selectedPreset={style.preset} onSelect={onStyleChange} />
        <PropertyRow label="Language"><select aria-label="Map language" value={style.language} onChange={(event) => onLanguageChange(event.target.value as MapLanguage)}><option value="local">Local names</option><option value="en">English</option><option value="de">German</option><option value="fr">French</option><option value="it">Italian</option><option value="es">Spanish</option><option value="zh">Chinese</option></select></PropertyRow>
        <PropertyRow label="Text scale"><TextScaleField key={`text-scale-${style.textScalePercent}`} value={style.textScalePercent} onCommit={onTextScaleChange} /></PropertyRow>
      </InspectorAccordion>
      <InspectorAccordion isDefaultExpanded={false} storageKey={`${PROJECT_DISCLOSURE_PREFIX}:camera-location`} summary={`${camera.bearing}° bearing · ${camera.pitch}° pitch · ${camera.locked ? 'Locked' : 'Unlocked'}`} title="Camera & location">
        <PropertyRow label="Bearing"><CameraField key={`bearing-${camera.bearing}`} field="bearing" value={camera.bearing} onCommit={onBearingChange} /></PropertyRow>
        <PropertyRow label="Pitch"><CameraField key={`pitch-${camera.pitch}`} field="pitch" value={camera.pitch} onCommit={onPitchChange} /></PropertyRow>
        <Switch isChecked={camera.locked} label="Lock map area" onCheckedChange={onMapAreaLockChange} />
        <GeolocationControl key={`${documentEpoch}-${String(camera.locked)}`} locked={camera.locked} requestScope={documentEpoch} onLocate={onLocate} />
      </InspectorAccordion>
      <InspectorAccordion isDefaultExpanded={false} storageKey={`${PROJECT_DISCLOSURE_PREFIX}:map-details`} summary={`${visibleMapDetailCount} of 7 visible`} title="Map details">
        <Checkbox isChecked={style.visibility.roads} label="Show roads" onCheckedChange={(isChecked) => onFeatureVisibilityChange('roads', isChecked)} />
        <Checkbox isChecked={style.visibility.buildings} label="Show buildings" onCheckedChange={(isChecked) => onFeatureVisibilityChange('buildings', isChecked)} />
        <Checkbox isChecked={style.visibility.labels} label="Show labels" onCheckedChange={(isChecked) => onFeatureVisibilityChange('labels', isChecked)} />
        <Checkbox isChecked={style.visibility.water} label="Show water" onCheckedChange={(isChecked) => onFeatureVisibilityChange('water', isChecked)} />
        <Checkbox isChecked={style.visibility.parks} label="Show parks" onCheckedChange={(isChecked) => onFeatureVisibilityChange('parks', isChecked)} />
        <Checkbox isChecked={style.visibility.landuse} label="Show land detail" onCheckedChange={(isChecked) => onFeatureVisibilityChange('landuse', isChecked)} />
        <Checkbox isChecked={style.visibility.transit} label="Show transit" onCheckedChange={(isChecked) => onFeatureVisibilityChange('transit', isChecked)} />
      </InspectorAccordion>
      <InspectorAccordion isDefaultExpanded={false} storageKey={`${PROJECT_DISCLOSURE_PREFIX}:provider-services`} summary="Public-token status and compliance" title="Provider services">
        <MapboxServiceStatus />
      </InspectorAccordion>
      <InspectorAccordion isDefaultExpanded={false} storageKey={`${PROJECT_DISCLOSURE_PREFIX}:technical-export`} summary="Format-specific · Attribution included" title="Output settings">
        <PropertyRow label="Resolution"><select aria-label="Export resolution" value="Format-specific" disabled><option>Format-specific</option></select></PropertyRow>
        <Checkbox isChecked disabled readOnly label="Include map attribution" />
      </InspectorAccordion>
    </div>
  );
}
