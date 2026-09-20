import { memo, useCallback, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { RotateCcw } from 'lucide-react';
import type { CameraSettings, MapFeatureVisibilityCategory, MapLanguage, MapStylePreset, MapStyleSettings, PagePreset, PageSettings } from '../../domain/project';
import { isMapStyleCustomized, type MapStyleTone } from '../../domain/mapStyleCustomization';
import type { MapStyleTokenRole } from '../../domain/mapStylePresets';
import { PAGE_PRESET_DEFINITIONS } from '../../domain/pagePresets';
import { InspectorAccordion, PropertyRow } from './PropertyControls';
import { GeolocationControl } from './GeolocationControl';
import { Checkbox, Switch } from './UiControls';
import { MAP_STYLE_PRESET_LABELS } from '../../domain/mapStylePresets';
import { MapStyleGallery } from './MapStyleGallery';
import { MapStyleCustomizer, MapStyleCustomizeTrigger } from './MapStyleCustomizer';
import { ValidatedNumberField } from './ValidatedNumberField';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import { useStableEvent } from '../hooks/useStableEvent';

/**
 * The inspector renders orientation controls only. Centre and zoom are excluded
 * deliberately: they are written at pointer rate while panning, and subscribing
 * to them here would re-render the inspector on every frame of a map drag.
 */
export type CameraInspectorView = Pick<CameraSettings, 'bearing' | 'locked' | 'pitch'>;

type ProjectPropertiesProps = {
  terrainControls?: ReactNode;
  studioControls?: ReactNode;
  documentEpoch: number;
  page: PageSettings;
  pageBoundaryVisible: boolean;
  camera: CameraInspectorView;
  style: MapStyleSettings;
  onBearingChange: (bearing: number) => ProjectMutationResult;
  onDimensionChange: (dimension: 'widthMm' | 'heightMm', value: number) => ProjectMutationResult;
  onFeatureVisibilityChange: (category: MapFeatureVisibilityCategory, isVisible: boolean) => ProjectMutationResult;
  onLanguageChange: (language: MapLanguage) => ProjectMutationResult;
  onLocate: (coordinate: [number, number], onApplied: () => void) => void;
  onMapAreaLockChange: (isLocked: boolean) => ProjectMutationResult;
  onPageBoundaryVisibilityChange: (isVisible: boolean) => void;
  onOrientationChange: (orientation: PageSettings['orientation']) => ProjectMutationResult;
  onPitchChange: (pitch: number) => ProjectMutationResult;
  onPresetChange: (preset: PagePreset) => ProjectMutationResult;
  onStyleChange: (preset: MapStylePreset) => ProjectMutationResult;
  onStyleAdjustmentChange: (adjustment: 'contrast' | 'detail', value: number, mode?: 'history' | 'amend') => ProjectMutationResult;
  onStyleColorChange: (role: MapStyleTokenRole, color: string | null, mode?: 'history' | 'amend') => ProjectMutationResult;
  onStyleCustomizationReset: () => ProjectMutationResult;
  onStyleReset: () => ProjectMutationResult;
  onStyleToneChange: (tone: MapStyleTone) => ProjectMutationResult;
  onTextScaleChange: (textScalePercent: number) => ProjectMutationResult;
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
  terrainControls,
  studioControls,
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
  onStyleAdjustmentChange,
  onStyleChange,
  onStyleColorChange,
  onStyleCustomizationReset,
  onStyleReset,
  onStyleToneChange,
  onTextScaleChange,
}: ProjectPropertiesProps) {
  const [isStyleCustomizerOpen, setIsStyleCustomizerOpen] = useState(false);
  const [hasReturnedFromStyle, setHasReturnedFromStyle] = useState(false);
  const customizeTriggerRef = useRef<HTMLButtonElement>(null);
  const openStyleCustomizer = useCallback(() => {
    trackEditorAction('mapStyleCustomizerOpened');
    setIsStyleCustomizerOpen(true);
  }, []);
  if (isStyleCustomizerOpen) {
    return (
      <MapStyleCustomizer
        customization={style.customization}
        preset={style.preset}
        onAdjustmentChange={onStyleAdjustmentChange}
        onBack={() => {
          trackEditorAction('mapStyleCustomizerClosed');
          setHasReturnedFromStyle(true);
          setIsStyleCustomizerOpen(false);
          queueMicrotask(() => customizeTriggerRef.current?.focus());
        }}
        onColorChange={onStyleColorChange}
        onReset={onStyleCustomizationReset}
        onResetMapStyle={onStyleReset}
        onToneChange={onStyleToneChange}
      />
    );
  }
  return (
    <div className={`properties-panel inspector-subview${hasReturnedFromStyle ? ' is-back' : ''}`}>
      <div className="properties-title"><h2 data-project-heading tabIndex={-1}>Project</h2></div>
      <ProjectPageSection page={page} documentEpoch={documentEpoch} onDimensionChange={onDimensionChange} onOrientationChange={onOrientationChange} onPresetChange={onPresetChange} />
      <ProjectStyleSection preset={style.preset} customization={style.customization} language={style.language} textScalePercent={style.textScalePercent}
        documentEpoch={documentEpoch} onLanguageChange={onLanguageChange} onStyleChange={onStyleChange} onStyleReset={onStyleReset} onTextScaleChange={onTextScaleChange}
        customizeTriggerRef={customizeTriggerRef} onOpenCustomizer={openStyleCustomizer} />
      <ProjectCameraSection camera={camera} documentEpoch={documentEpoch} onBearingChange={onBearingChange} onPitchChange={onPitchChange} onMapAreaLockChange={onMapAreaLockChange} onLocate={onLocate} />
      <ProjectDetailsSection visibility={style.visibility} pageBoundaryVisible={pageBoundaryVisible} onFeatureVisibilityChange={onFeatureVisibilityChange} onPageBoundaryVisibilityChange={onPageBoundaryVisibilityChange} />
      {studioControls}
      {terrainControls}
    </div>
  );
}

const ProjectPageSection = memo(function ProjectPageSection({ page, documentEpoch, onDimensionChange, onOrientationChange, onPresetChange }: Pick<ProjectPropertiesProps, 'page' | 'documentEpoch' | 'onDimensionChange' | 'onOrientationChange' | 'onPresetChange'>) {
  const pageFeedback = useMutationFeedback(page);
  return <InspectorAccordion isDefaultExpanded storageKey={`${PROJECT_DISCLOSURE_PREFIX}:page`} summary={`${page.preset} ${page.orientation} · ${page.widthMm} × ${page.heightMm} mm`} title="Page">
        <PropertyRow label="Preset"><select aria-label="Page preset" value={page.preset} onChange={(event) => pageFeedback.report(onPresetChange(event.target.value as PagePreset))}>{PAGE_PRESET_DEFINITIONS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}<option value="Custom">Custom</option></select></PropertyRow>
        <div className="paired-fields">
          <ValidatedNumberField label="Page width" prefix="W" value={page.widthMm} minimum={0.1} step={0.1} unit="mm" resetKey={`${documentEpoch}:${page.preset}`} onCommit={(value) => onDimensionChange('widthMm', value)} />
          <ValidatedNumberField label="Page height" prefix="H" value={page.heightMm} minimum={0.1} step={0.1} unit="mm" resetKey={`${documentEpoch}:${page.preset}`} onCommit={(value) => onDimensionChange('heightMm', value)} />
        </div>
        <PropertyRow label="Orientation"><div className="segmented"><button className={page.orientation === 'landscape' ? 'is-active' : undefined} type="button" aria-pressed={page.orientation === 'landscape'} onClick={() => pageFeedback.report(onOrientationChange('landscape'))}>Landscape</button><button className={page.orientation === 'portrait' ? 'is-active' : undefined} type="button" aria-pressed={page.orientation === 'portrait'} onClick={() => pageFeedback.report(onOrientationChange('portrait'))}>Portrait</button></div></PropertyRow>
        {pageFeedback.error && <p className="coordinate-validation" role="alert">{pageFeedback.error}</p>}
      </InspectorAccordion>
});

const ProjectStyleSection = memo(function ProjectStyleSection({ preset, customization, language, textScalePercent, documentEpoch, onStyleChange, onStyleReset, onLanguageChange, onTextScaleChange, customizeTriggerRef, onOpenCustomizer }:
  Pick<MapStyleSettings, 'preset' | 'customization' | 'language' | 'textScalePercent'> &
  Pick<ProjectPropertiesProps, 'documentEpoch' | 'onStyleChange' | 'onStyleReset' | 'onLanguageChange' | 'onTextScaleChange'> &
  { customizeTriggerRef: RefObject<HTMLButtonElement | null>; onOpenCustomizer: () => void }) {
  const style = useMemo(() => ({ preset, customization, language, textScalePercent }), [preset, customization, language, textScalePercent]);
  const styleFeedback = useMutationFeedback(style);
  const selectStyle = useStableEvent((preset: MapStylePreset) => styleFeedback.report(onStyleChange(preset)));
  const mapStyleSummary = `${MAP_STYLE_PRESET_LABELS[preset]}${isMapStyleCustomized(customization) ? ' · Custom' : ''} · ${MAP_LANGUAGE_LABELS[language]} · ${textScalePercent}%`;
  return <InspectorAccordion isDefaultExpanded={false} storageKey={`${PROJECT_DISCLOSURE_PREFIX}:map-style`} summary={mapStyleSummary} title="Map style">
        <MapStyleGallery selectedPreset={style.preset} onSelect={selectStyle} />
        <MapStyleCustomizeTrigger
          buttonRef={customizeTriggerRef}
          customization={style.customization}
          preset={style.preset}
          onOpen={onOpenCustomizer}
        />
        <button
          className="map-style-default-reset"
          disabled={style.preset === 'paper' && !isMapStyleCustomized(style.customization)}
          type="button"
          onClick={() => styleFeedback.report(onStyleReset())}
        >
          <RotateCcw aria-hidden="true" size={13} /> Reset to Paper
        </button>
        <PropertyRow label="Language"><select aria-label="Map language" value={style.language} onChange={(event) => styleFeedback.report(onLanguageChange(event.target.value as MapLanguage))}><option value="local">Local names</option><option value="en">English</option><option value="de">German</option><option value="fr">French</option><option value="it">Italian</option><option value="es">Spanish</option><option value="zh">Chinese</option></select></PropertyRow>
        <PropertyRow label="Text scale"><ValidatedNumberField label="Text scale" value={style.textScalePercent} minimum={50} maximum={200} step={5} unit="%" resetKey={documentEpoch} onCommit={onTextScaleChange} /></PropertyRow>
        {styleFeedback.error && <p className="coordinate-validation" role="alert">{styleFeedback.error}</p>}
      </InspectorAccordion>
});

const ProjectCameraSection = memo(function ProjectCameraSection({ camera, documentEpoch, onBearingChange, onPitchChange, onMapAreaLockChange, onLocate }: Pick<ProjectPropertiesProps, 'camera' | 'documentEpoch' | 'onBearingChange' | 'onPitchChange' | 'onMapAreaLockChange' | 'onLocate'>) {
  const cameraFeedback = useMutationFeedback(camera);
  return <InspectorAccordion isDefaultExpanded={false} storageKey={`${PROJECT_DISCLOSURE_PREFIX}:camera-location`} summary={`${camera.bearing}° bearing · ${camera.pitch}° pitch · ${camera.locked ? 'Locked' : 'Unlocked'}`} title="Camera & location">
        <PropertyRow label="Bearing"><ValidatedNumberField label="Bearing" value={camera.bearing} minimum={-180} maximum={180} step={1} unit="°" resetKey={documentEpoch} onCommit={onBearingChange} /></PropertyRow>
        <PropertyRow label="Pitch"><ValidatedNumberField label="Pitch" value={camera.pitch} minimum={0} maximum={60} step={1} unit="°" resetKey={documentEpoch} onCommit={onPitchChange} /></PropertyRow>
        <Switch isChecked={camera.locked} label="Lock map area" onCheckedChange={(locked) => cameraFeedback.report(onMapAreaLockChange(locked))} />
        {cameraFeedback.error && <p className="coordinate-validation" role="alert">{cameraFeedback.error}</p>}
        <GeolocationControl key={`${documentEpoch}-${String(camera.locked)}`} locked={camera.locked} requestScope={documentEpoch} onLocate={onLocate} />
      </InspectorAccordion>
});

const ProjectDetailsSection = memo(function ProjectDetailsSection({ visibility, pageBoundaryVisible, onFeatureVisibilityChange, onPageBoundaryVisibilityChange }: Pick<ProjectPropertiesProps, 'pageBoundaryVisible' | 'onFeatureVisibilityChange' | 'onPageBoundaryVisibilityChange'> & { visibility: MapStyleSettings['visibility'] }) {
  const detailFeedback = useMutationFeedback(visibility);
  const featureVisibilityChange = (category: MapFeatureVisibilityCategory, isVisible: boolean) => detailFeedback.report(onFeatureVisibilityChange(category, isVisible));
  const visibleMapDetailCount = Object.values(visibility).filter(Boolean).length + Number(pageBoundaryVisible);
  return <InspectorAccordion isDefaultExpanded={false} storageKey={`${PROJECT_DISCLOSURE_PREFIX}:map-details`} summary={`${visibleMapDetailCount} of 8 visible`} title="Map details">
        <Checkbox isChecked={pageBoundaryVisible} label="Show page boundary" onCheckedChange={onPageBoundaryVisibilityChange} />
        <Checkbox isChecked={visibility.roads} label="Show roads" onCheckedChange={(isChecked) => featureVisibilityChange('roads', isChecked)} />
        <Checkbox isChecked={visibility.buildings} label="Show buildings" onCheckedChange={(isChecked) => featureVisibilityChange('buildings', isChecked)} />
        <Checkbox isChecked={visibility.labels} label="Show labels" onCheckedChange={(isChecked) => featureVisibilityChange('labels', isChecked)} />
        <Checkbox isChecked={visibility.water} label="Show water" onCheckedChange={(isChecked) => featureVisibilityChange('water', isChecked)} />
        <Checkbox isChecked={visibility.parks} label="Show parks" onCheckedChange={(isChecked) => featureVisibilityChange('parks', isChecked)} />
        <Checkbox isChecked={visibility.landuse} label="Show land detail" onCheckedChange={(isChecked) => featureVisibilityChange('landuse', isChecked)} />
        <Checkbox isChecked={visibility.transit} label="Show transit" onCheckedChange={(isChecked) => featureVisibilityChange('transit', isChecked)} />
        {detailFeedback.error && <p className="coordinate-validation" role="alert">{detailFeedback.error}</p>}
      </InspectorAccordion>;
});
