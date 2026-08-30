import { useRef, useState } from 'react';
import type { CameraSettings, MapFeatureVisibilityCategory, MapLanguage, MapStylePreset, MapStyleSettings, PagePreset, PageSettings } from '../../domain/project';
import { PAGE_PRESET_DEFINITIONS } from '../../domain/pagePresets';
import { InspectorAccordion, PropertyRow } from './PropertyControls';
import { GeolocationControl } from './GeolocationControl';
import { Checkbox, Switch } from './UiControls';
import { MAP_STYLE_PRESET_LABELS } from '../../domain/mapStylePresets';
import { MapStyleGallery } from './MapStyleGallery';
import { InputGroup, InputGroupAddon, InputNumber } from './InputGroup';

function isValidPageDimension(draft: string) {
  const value = Number(draft);
  return draft.trim() !== '' && Number.isFinite(value) && value >= 0.1;
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
    <InputGroup>
      <InputGroupAddon enableScrubbing sensitivity={0.4}>{label}</InputGroupAddon>
      <InputNumber
        aria-label={ariaLabel}
        min={0.1}
        step={0.1}
        value={draft}
        aria-invalid={!isValidPageDimension(draft)}
        onChange={(event) => {
          setDraft(event.target.value);
          dirtyRef.current = true;
        }}
        onBlur={commit}
      />
      <InputGroupAddon align="inline-end">mm</InputGroupAddon>
    </InputGroup>
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
    <InputGroup>
      <InputNumber
        aria-label={field === 'bearing' ? 'Bearing' : 'Pitch'}
        aria-invalid={!isValidCameraDraft(field, draft)}
        min={field === 'bearing' ? -180 : 0}
        max={field === 'bearing' ? 180 : 60}
        step={1}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          dirtyRef.current = true;
        }}
        onBlur={commit}
      />
      <InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>°</InputGroupAddon>
    </InputGroup>
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
    <InputGroup>
      <InputNumber
        aria-label="Text scale"
        aria-invalid={!isValid}
        min={50}
        max={200}
        step={5}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          dirtyRef.current = true;
        }}
        onBlur={commit}
      />
      <InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>%</InputGroupAddon>
    </InputGroup>
  );
}

/**
 * The inspector renders orientation controls only. Centre and zoom are excluded
 * deliberately: they are written at pointer rate while panning, and subscribing
 * to them here would re-render the inspector on every frame of a map drag.
 */
export type CameraInspectorView = Pick<CameraSettings, 'bearing' | 'locked' | 'pitch'>;

type ProjectPropertiesProps = {
  documentEpoch: number;
  page: PageSettings;
  pageBoundaryVisible: boolean;
  camera: CameraInspectorView;
  style: MapStyleSettings;
  onBearingChange: (bearing: number) => void;
  onDimensionChange: (dimension: 'widthMm' | 'heightMm', value: number) => void;
  onFeatureVisibilityChange: (category: MapFeatureVisibilityCategory, isVisible: boolean) => void;
  onLanguageChange: (language: MapLanguage) => void;
  onLocate: (coordinate: [number, number], onApplied: () => void) => void;
  onMapAreaLockChange: (isLocked: boolean) => void;
  onPageBoundaryVisibilityChange: (isVisible: boolean) => void;
  onOrientationChange: (orientation: PageSettings['orientation']) => void;
  onPitchChange: (pitch: number) => void;
  onPresetChange: (preset: PagePreset) => void;
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
  pageBoundaryVisible,
  onDimensionChange,
  onFeatureVisibilityChange,
  onLanguageChange,
  onLocate,
  onMapAreaLockChange,
  onPageBoundaryVisibilityChange,
  onOrientationChange,
  onPitchChange,
  onPresetChange,
  onStyleChange,
  onTextScaleChange,
}: ProjectPropertiesProps) {
  const visibleMapDetailCount = Object.values(style.visibility).filter(Boolean).length + Number(pageBoundaryVisible);
  return (
    <div className="properties-panel">
      <div className="properties-title"><h2 data-project-heading tabIndex={-1}>Project</h2></div>
      <InspectorAccordion isDefaultExpanded storageKey={`${PROJECT_DISCLOSURE_PREFIX}:page`} summary={`${page.preset} ${page.orientation} · ${page.widthMm} × ${page.heightMm} mm`} title="Page">
        <PropertyRow label="Preset"><select aria-label="Page preset" value={page.preset} onChange={(event) => onPresetChange(event.target.value as PagePreset)}>{PAGE_PRESET_DEFINITIONS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}<option value="Custom">Custom</option></select></PropertyRow>
        <div className="paired-fields">
          <PageDimensionField key={`width-${page.widthMm}-${page.preset}`} label="W" ariaLabel="Page width" dimension="widthMm" value={page.widthMm} onCommit={onDimensionChange} />
          <PageDimensionField key={`height-${page.heightMm}-${page.preset}`} label="H" ariaLabel="Page height" dimension="heightMm" value={page.heightMm} onCommit={onDimensionChange} />
        </div>
        <PropertyRow label="Orientation"><div className="segmented"><button className={page.orientation === 'landscape' ? 'is-active' : undefined} type="button" aria-pressed={page.orientation === 'landscape'} onClick={() => onOrientationChange('landscape')}>Landscape</button><button className={page.orientation === 'portrait' ? 'is-active' : undefined} type="button" aria-pressed={page.orientation === 'portrait'} onClick={() => onOrientationChange('portrait')}>Portrait</button></div></PropertyRow>
      </InspectorAccordion>
      <InspectorAccordion isDefaultExpanded={false} storageKey={`${PROJECT_DISCLOSURE_PREFIX}:map-style`} summary={`${MAP_STYLE_PRESET_LABELS[style.preset]} · ${MAP_LANGUAGE_LABELS[style.language]} · ${style.textScalePercent}%`} title="Map style">
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
      <InspectorAccordion isDefaultExpanded={false} storageKey={`${PROJECT_DISCLOSURE_PREFIX}:map-details`} summary={`${visibleMapDetailCount} of 8 visible`} title="Map details">
        <Checkbox isChecked={pageBoundaryVisible} label="Show page boundary" onCheckedChange={onPageBoundaryVisibilityChange} />
        <Checkbox isChecked={style.visibility.roads} label="Show roads" onCheckedChange={(isChecked) => onFeatureVisibilityChange('roads', isChecked)} />
        <Checkbox isChecked={style.visibility.buildings} label="Show buildings" onCheckedChange={(isChecked) => onFeatureVisibilityChange('buildings', isChecked)} />
        <Checkbox isChecked={style.visibility.labels} label="Show labels" onCheckedChange={(isChecked) => onFeatureVisibilityChange('labels', isChecked)} />
        <Checkbox isChecked={style.visibility.water} label="Show water" onCheckedChange={(isChecked) => onFeatureVisibilityChange('water', isChecked)} />
        <Checkbox isChecked={style.visibility.parks} label="Show parks" onCheckedChange={(isChecked) => onFeatureVisibilityChange('parks', isChecked)} />
        <Checkbox isChecked={style.visibility.landuse} label="Show land detail" onCheckedChange={(isChecked) => onFeatureVisibilityChange('landuse', isChecked)} />
        <Checkbox isChecked={style.visibility.transit} label="Show transit" onCheckedChange={(isChecked) => onFeatureVisibilityChange('transit', isChecked)} />
      </InspectorAccordion>
    </div>
  );
}
