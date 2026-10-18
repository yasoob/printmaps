import { Activity, memo, useCallback, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { RotateCcw } from 'lucide-react';
import type { CameraSettings, MapFeatureVisibilityCategory, MapLanguage, MapStylePreset, MapStyleSettings } from '../../domain/project';
import { isMapStyleCustomized, type MapStyleTone } from '../../domain/mapStyleCustomization';
import type { MapStyleTokenRole } from '../../domain/mapStylePresets';
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
import { StudioModeTabs } from './StudioModeTabs';

// Camera-rate center and zoom updates do not belong to the inspector.
export type CameraInspectorView = Pick<CameraSettings, 'bearing' | 'locked' | 'pitch'>;

type ProjectPropertiesProps = {
  layoutRequest?: number;
  mapRequest?: number;
  terrainControls?: ReactNode;
  studioControls?: ReactNode;
  documentEpoch: number;
  pageBoundaryVisible: boolean;
  camera: CameraInspectorView;
  style: MapStyleSettings;
  onBearingChange: (bearing: number) => ProjectMutationResult;
  onFeatureVisibilityChange: (category: MapFeatureVisibilityCategory, isVisible: boolean) => ProjectMutationResult;
  onLanguageChange: (language: MapLanguage) => ProjectMutationResult;
  onLocate: (coordinate: [number, number], onApplied: () => void) => void;
  onMapAreaLockChange: (isLocked: boolean) => ProjectMutationResult;
  onPageBoundaryVisibilityChange: (isVisible: boolean) => void;
  onPitchChange: (pitch: number) => ProjectMutationResult;
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
  de: 'German', en: 'English', es: 'Spanish', fr: 'French',
  it: 'Italian', local: 'Local names', zh: 'Chinese',
};
const TABS = [{ value: 'Map', label: 'Map' }, { value: 'Layout', label: 'Layout' }] as const;

export function ProjectProperties(props: ProjectPropertiesProps) {
  const { camera, documentEpoch, style } = props;
  const [tab, setTab] = useState<'Map' | 'Layout'>('Map');
  const [lastLayoutRequest, setLastLayoutRequest] = useState(0);
  const [lastMapRequest, setLastMapRequest] = useState(0);
  const [hasOpenedLayout, setHasOpenedLayout] = useState(false);
  const [isStyleCustomizerOpen, setIsStyleCustomizerOpen] = useState(false);
  const customizeTriggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  if (props.layoutRequest && props.layoutRequest !== lastLayoutRequest) {
    setLastLayoutRequest(props.layoutRequest);
    setHasOpenedLayout(true);
    setTab('Layout');
  }
  if (props.mapRequest && props.mapRequest !== lastMapRequest) {
    setLastMapRequest(props.mapRequest);
    setIsStyleCustomizerOpen(false);
    setTab('Map');
  }
  const openStyleCustomizer = useCallback(() => {
    trackEditorAction('mapStyleCustomizerOpened');
    setIsStyleCustomizerOpen(true);
  }, []);
  const selectTab = useCallback((next: typeof tab) => {
    setTab(next);
    if (next === 'Layout') setHasOpenedLayout(true);
  }, []);
  return <div className="properties-panel project-inspector">
    <div className="properties-title"><h2 data-project-heading tabIndex={-1}>Project</h2></div>
    <div className="inspector-tabs">
      <StudioModeTabs choices={TABS} value={tab} onValueChange={selectTab} label="Project settings" idPrefix={id} />
    </div>
    <Activity mode={tab === 'Map' ? 'visible' : 'hidden'}>
      <div id={`${id}-Map-panel`} role="tabpanel" aria-labelledby={`${id}-Map-tab`}>
        <Activity mode={isStyleCustomizerOpen ? 'hidden' : 'visible'}>
          <ProjectStyleSection preset={style.preset} customization={style.customization}
            onStyleChange={props.onStyleChange} onStyleReset={props.onStyleReset}
            customizeTriggerRef={customizeTriggerRef} onOpenCustomizer={openStyleCustomizer} />
          <ProjectDetailsSection visibility={style.visibility} language={style.language} textScalePercent={style.textScalePercent}
            documentEpoch={documentEpoch} onLanguageChange={props.onLanguageChange} onTextScaleChange={props.onTextScaleChange}
            onFeatureVisibilityChange={props.onFeatureVisibilityChange} />
          {props.terrainControls}
          <ProjectCameraSection camera={camera} documentEpoch={documentEpoch} onBearingChange={props.onBearingChange}
            onPitchChange={props.onPitchChange} onMapAreaLockChange={props.onMapAreaLockChange} onLocate={props.onLocate}
            pageBoundaryVisible={props.pageBoundaryVisible} onPageBoundaryVisibilityChange={props.onPageBoundaryVisibilityChange} />
        </Activity>
        {isStyleCustomizerOpen && <MapStyleCustomizer
          customization={style.customization} preset={style.preset}
          onAdjustmentChange={props.onStyleAdjustmentChange}
          onBack={() => {
            trackEditorAction('mapStyleCustomizerClosed');
            setIsStyleCustomizerOpen(false);
            window.setTimeout(() => customizeTriggerRef.current?.focus(), 0);
          }}
          onColorChange={props.onStyleColorChange} onReset={props.onStyleCustomizationReset}
          onResetMapStyle={props.onStyleReset} onToneChange={props.onStyleToneChange}
        />}
      </div>
    </Activity>
    {hasOpenedLayout && <Activity mode={tab === 'Layout' ? 'visible' : 'hidden'}>
      <div id={`${id}-Layout-panel`} role="tabpanel" aria-labelledby={`${id}-Layout-tab`}>{props.studioControls}</div>
    </Activity>}
  </div>;
}

const ProjectStyleSection = memo(function ProjectStyleSection({ preset, customization, onStyleChange, onStyleReset, customizeTriggerRef, onOpenCustomizer }:
  Pick<MapStyleSettings, 'preset' | 'customization'> &
  Pick<ProjectPropertiesProps, 'onStyleChange' | 'onStyleReset'> &
  { customizeTriggerRef: RefObject<HTMLButtonElement | null>; onOpenCustomizer: () => void }) {
  const style = useMemo(() => ({ preset, customization }), [preset, customization]);
  const feedback = useMutationFeedback(style);
  const selectStyle = useStableEvent((preset: MapStylePreset) => feedback.report(onStyleChange(preset)));
  const isDefaultStyle = preset === 'paper' && !isMapStyleCustomized(customization);
  return <InspectorAccordion isDefaultExpanded storageKey={`${PROJECT_DISCLOSURE_PREFIX}:map-style`}
    summary={`${MAP_STYLE_PRESET_LABELS[preset]}${isMapStyleCustomized(customization) ? ' · Custom' : ''}`} title="Style">
    <MapStyleGallery selectedPreset={preset} onSelect={selectStyle} />
    <MapStyleCustomizeTrigger buttonRef={customizeTriggerRef} customization={customization} preset={preset} onOpen={onOpenCustomizer} />
    {!isDefaultStyle && <div className="map-style-default-reset-row">
      <button className="map-style-default-reset" type="button" onClick={() => {
        if (feedback.report(onStyleReset()).ok) window.setTimeout(() => customizeTriggerRef.current?.focus(), 0);
      }}>
        <RotateCcw aria-hidden="true" size={14} /> Reset to Paper
      </button>
    </div>}
    {feedback.error && <p className="coordinate-validation" role="alert">{feedback.error}</p>}
  </InspectorAccordion>;
});

const ProjectCameraSection = memo(function ProjectCameraSection({ camera, documentEpoch, onBearingChange, onPitchChange, onMapAreaLockChange, onLocate, pageBoundaryVisible, onPageBoundaryVisibilityChange }: Pick<ProjectPropertiesProps, 'camera' | 'documentEpoch' | 'onBearingChange' | 'onPitchChange' | 'onMapAreaLockChange' | 'onLocate' | 'pageBoundaryVisible' | 'onPageBoundaryVisibilityChange'>) {
  const feedback = useMutationFeedback(camera);
  return <InspectorAccordion isDefaultExpanded={false} storageKey={`${PROJECT_DISCLOSURE_PREFIX}:camera-location`} summary={`${camera.bearing}° bearing · ${camera.pitch}° pitch · ${camera.locked ? 'Locked' : 'Unlocked'}`} title="View">
    <PropertyRow label="Bearing"><ValidatedNumberField label="Bearing" value={camera.bearing} minimum={-180} maximum={180} step={1} unit="°" resetKey={documentEpoch} onCommit={onBearingChange} /></PropertyRow>
    <PropertyRow label="Pitch"><ValidatedNumberField label="Pitch" value={camera.pitch} minimum={0} maximum={60} step={1} unit="°" resetKey={documentEpoch} onCommit={onPitchChange} /></PropertyRow>
    <Switch isChecked={camera.locked} label="Lock map area" onCheckedChange={(locked) => feedback.report(onMapAreaLockChange(locked))} />
    <Switch isChecked={pageBoundaryVisible} label="Show page boundary" onCheckedChange={onPageBoundaryVisibilityChange} />
    {feedback.error && <p className="coordinate-validation" role="alert">{feedback.error}</p>}
    <GeolocationControl key={`${documentEpoch}-${String(camera.locked)}`} locked={camera.locked} requestScope={documentEpoch} onLocate={onLocate} />
  </InspectorAccordion>;
});

const ProjectDetailsSection = memo(function ProjectDetailsSection({ visibility, language, textScalePercent, documentEpoch, onFeatureVisibilityChange, onLanguageChange, onTextScaleChange }:
  Pick<ProjectPropertiesProps, 'documentEpoch' | 'onFeatureVisibilityChange' | 'onLanguageChange' | 'onTextScaleChange'> &
  Pick<MapStyleSettings, 'visibility' | 'language' | 'textScalePercent'>) {
  const settings = useMemo(() => ({ visibility, language, textScalePercent }), [visibility, language, textScalePercent]);
  const feedback = useMutationFeedback(settings);
  return <InspectorAccordion isDefaultExpanded={false} storageKey={`${PROJECT_DISCLOSURE_PREFIX}:map-details`}
    summary={`${MAP_LANGUAGE_LABELS[language]} · ${textScalePercent}% · ${Object.values(visibility).filter(Boolean).length} of 7 visible`} title="Labels & details">
    <PropertyRow label="Language"><select aria-label="Map language" value={language} onChange={(event) => feedback.report(onLanguageChange(event.target.value as MapLanguage))}>
      {Object.entries(MAP_LANGUAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></PropertyRow>
    <PropertyRow label="Text scale"><ValidatedNumberField label="Text scale" value={textScalePercent} minimum={50} maximum={200} step={5} unit="%" resetKey={documentEpoch} onCommit={onTextScaleChange} /></PropertyRow>
    {(['labels', 'roads', 'buildings', 'water', 'parks', 'landuse', 'transit'] as const).map((category) =>
      <Checkbox key={category} isChecked={visibility[category]} label={`Show ${category === 'landuse' ? 'land detail' : category}`}
        onCheckedChange={(isChecked) => feedback.report(onFeatureVisibilityChange(category, isChecked))} />)}
    {feedback.error && <p className="coordinate-validation" role="alert">{feedback.error}</p>}
  </InspectorAccordion>;
});
