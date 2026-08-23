import { useRef, useState } from 'react';
import type {
  ContentLayer,
  LayerAppearance,
  RouteAppearance,
  ShapeAppearance,
} from '../../domain/project';
import type { CustomMarkerAsset } from '../../domain/customMarkerAssets';
import {
  ROUTE_TRAVEL_PROFILES,
  ROUTE_TRAVEL_PROFILE_LABELS,
  type RouteTravelProfile,
} from '../../domain/routeProfiles';
import { CoordinateField } from './CoordinateField';
import { ElevationProfilePanel } from './ElevationProfilePanel';
import { MultiPartGeometryStatus } from './MultiPartGeometryStatus';
import { PoiAppearanceControls } from './PoiAppearanceControls';
import { PropertyRow, PropertySection } from './PropertyControls';
import { RouteVertexControls } from './RouteVertexControls';
import { ShapeVertexControls } from './ShapeVertexControls';

type LayerPropertiesProps = {
  layer: ContentLayer;
  assets: Record<string, CustomMarkerAsset>;
  onRename: (name: string) => void;
  onOpacityChange: (opacity: number) => void;
  onAppearanceChange: (appearance: LayerAppearance) => void;
  onPoiCoordinatesChange: (coordinates: readonly [number, number]) => void;
  onPoiCustomMarkerChange: (asset: CustomMarkerAsset | null) => void;
  onRouteVertexChange: (vertexIndex: number, coordinates: readonly [number, number]) => void;
  onShapeVertexChange: (ringIndex: number, vertexIndex: number, coordinates: readonly [number, number]) => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function LayerMenu({ onDuplicate, onDelete }: Pick<LayerPropertiesProps, 'onDuplicate' | 'onDelete'>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      items[(currentIndex + direction + items.length) % items.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      queueMicrotask(() => buttonRef.current?.focus());
    }
  };
  const toggleMenu = () => {
    setOpen(!open);
    if (!open) queueMicrotask(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
  };

  return (
    <>
      <button ref={buttonRef} className="icon-button" type="button" aria-label="Layer menu" aria-haspopup="menu" aria-expanded={open} onClick={toggleMenu}>•••</button>
      {open && (
        <div ref={menuRef} className="layer-menu" role="menu" onKeyDown={handleKeyDown}>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDuplicate(); }}>Duplicate layer</button>
          <button className="danger-button" type="button" role="menuitem" onClick={onDelete}>Delete layer</button>
        </div>
      )}
    </>
  );
}

function RouteAppearanceControls({
  appearance,
  onChange,
}: {
  appearance: RouteAppearance;
  onChange: (appearance: RouteAppearance) => void;
}) {
  const [widthEdit, setWidthEdit] = useState(() => ({
    source: appearance.width,
    value: String(appearance.width),
  }));
  const widthDraft = widthEdit.source === appearance.width ? widthEdit.value : String(appearance.width);
  const widthValue = Number(widthDraft);
  const isWidthInvalid = widthDraft.trim() === ''
    || !Number.isFinite(widthValue)
    || widthValue < 1
    || widthValue > 16;
  const commitWidth = (value: string) => {
    const width = Number(value);
    if (value.trim() === '' || !Number.isFinite(width) || width < 1 || width > 16) {
      setWidthEdit({ source: appearance.width, value: String(appearance.width) });
      return;
    }
    setWidthEdit({ source: width, value: String(width) });
    onChange({ ...appearance, width });
  };

  return (
    <>
      <PropertyRow label="Color"><label className="color-field"><input aria-label="Route color" type="color" value={appearance.color} onChange={(event) => onChange({ ...appearance, color: event.target.value })} /></label></PropertyRow>
      <PropertyRow label="Width"><label className="number-field"><input aria-label="Route width" aria-invalid={isWidthInvalid || undefined} value={widthDraft} onChange={(event) => setWidthEdit({ source: appearance.width, value: event.target.value })} onBlur={(event) => commitWidth(event.currentTarget.value)} /><small>px</small></label></PropertyRow>
      <PropertyRow label="Profile"><select aria-label="Route travel profile" value={appearance.travelProfile} onChange={(event) => onChange({ ...appearance, travelProfile: event.target.value as RouteTravelProfile })}>{ROUTE_TRAVEL_PROFILES.map((profile) => <option key={profile} value={profile}>{ROUTE_TRAVEL_PROFILE_LABELS[profile]}</option>)}</select></PropertyRow>
      <label className="check-row"><input type="checkbox" aria-label="Show travel-mode marker" checked={appearance.showTravelModeIcon} onChange={(event) => onChange({ ...appearance, showTravelModeIcon: event.target.checked })} /> Show mode marker</label>
    </>
  );
}

function PoiCoordinateControls({
  coordinates,
  onChange,
}: {
  coordinates: readonly [number, number];
  onChange: (coordinates: readonly [number, number]) => void;
}) {
  return (
    <>
      <CoordinateField key={`longitude-${coordinates[0]}`} ariaLabel="POI longitude" label="Longitude" minimum={-180} maximum={180} value={coordinates[0]} onCommit={(longitude) => onChange([longitude, coordinates[1]])} />
      <CoordinateField key={`latitude-${coordinates[1]}`} ariaLabel="POI latitude" label="Latitude" minimum={-90} maximum={90} value={coordinates[1]} onCommit={(latitude) => onChange([coordinates[0], latitude])} />
    </>
  );
}

function ShapeAppearanceControls({
  appearance,
  onChange,
}: {
  appearance: ShapeAppearance;
  onChange: (appearance: ShapeAppearance) => void;
}) {
  const [widthEdit, setWidthEdit] = useState(() => ({
    source: appearance.strokeWidth,
    value: String(appearance.strokeWidth),
  }));
  const widthDraft = widthEdit.source === appearance.strokeWidth
    ? widthEdit.value
    : String(appearance.strokeWidth);
  const widthValue = Number(widthDraft);
  const isWidthInvalid = widthDraft.trim() === ''
    || !Number.isFinite(widthValue)
    || widthValue < 0.5
    || widthValue > 12;
  const commitWidth = (value: string) => {
    const strokeWidth = Number(value);
    if (value.trim() === '' || !Number.isFinite(strokeWidth) || strokeWidth < 0.5 || strokeWidth > 12) {
      setWidthEdit({ source: appearance.strokeWidth, value: String(appearance.strokeWidth) });
      return;
    }
    setWidthEdit({ source: strokeWidth, value: String(strokeWidth) });
    onChange({ ...appearance, strokeWidth });
  };

  return (
    <>
      <PropertyRow label="Fill"><label className="color-field"><input aria-label="Shape fill color" type="color" value={appearance.fillColor} onChange={(event) => onChange({ ...appearance, fillColor: event.target.value })} /></label></PropertyRow>
      <PropertyRow label="Outline"><label className="color-field"><input aria-label="Shape outline color" type="color" value={appearance.strokeColor} onChange={(event) => onChange({ ...appearance, strokeColor: event.target.value })} /></label></PropertyRow>
      <PropertyRow label="Width"><label className="number-field"><input aria-label="Shape outline width" aria-invalid={isWidthInvalid || undefined} value={widthDraft} onChange={(event) => setWidthEdit({ source: appearance.strokeWidth, value: event.target.value })} onBlur={(event) => commitWidth(event.currentTarget.value)} /><small>px</small></label></PropertyRow>
      <label className="check-row"><input type="checkbox" aria-label="Invert shape fill" checked={appearance.invert} onChange={(event) => onChange({ ...appearance, invert: event.target.checked })} /> Invert outside area</label>
    </>
  );
}

function RouteLayerProperties({
  layer,
  onAppearanceChange,
  onRouteVertexChange,
}: Pick<LayerPropertiesProps, 'layer' | 'onAppearanceChange' | 'onRouteVertexChange'>) {
  if (layer.appearance?.kind !== 'route') return null;
  return (
    <>
      <PropertySection title="Appearance">
        <RouteAppearanceControls key={`${layer.id}-${layer.appearance.width}`} appearance={layer.appearance} onChange={onAppearanceChange} />
      </PropertySection>
      {layer.geometry?.type === 'LineString' && (
        <>
          <PropertySection title="Vertices">
            <RouteVertexControls key={layer.id} coordinates={layer.geometry.coordinates} onChange={onRouteVertexChange} />
          </PropertySection>
          <PropertySection title="Elevation">
            <ElevationProfilePanel
              key={`${layer.id}-${JSON.stringify(layer.geometry.coordinates)}`}
              coordinates={layer.geometry.coordinates}
              routeName={layer.name}
              routeColor={layer.appearance.color}
            />
          </PropertySection>
        </>
      )}
    </>
  );
}

function PoiLayerProperties({
  layer,
  assets,
  onAppearanceChange,
  onPoiCoordinatesChange,
  onPoiCustomMarkerChange,
}: Pick<LayerPropertiesProps, 'layer' | 'assets' | 'onAppearanceChange' | 'onPoiCoordinatesChange' | 'onPoiCustomMarkerChange'>) {
  const appearance = layer.appearance?.kind === 'poi' ? layer.appearance : undefined;
  const customAsset = appearance?.customAssetId ? assets[appearance.customAssetId] : undefined;
  return (
    <>
      {appearance && (
        <PropertySection title="Appearance">
          <PoiAppearanceControls key={`${layer.id}-${appearance.size}-${appearance.label}`} appearance={appearance} customAsset={customAsset} onChange={onAppearanceChange} onCustomMarkerChange={onPoiCustomMarkerChange} />
        </PropertySection>
      )}
      {layer.geometry?.type === 'Point' && (
        <PropertySection title="Location">
          <PoiCoordinateControls coordinates={layer.geometry.coordinates} onChange={onPoiCoordinatesChange} />
        </PropertySection>
      )}
    </>
  );
}

function LayerTypeProperties({
  layer,
  assets,
  onAppearanceChange,
  onPoiCoordinatesChange,
  onPoiCustomMarkerChange,
  onRouteVertexChange,
  onShapeVertexChange,
}: Pick<LayerPropertiesProps, 'layer' | 'assets' | 'onAppearanceChange' | 'onPoiCoordinatesChange' | 'onPoiCustomMarkerChange' | 'onRouteVertexChange' | 'onShapeVertexChange'>) {
  switch (layer.type) {
    case 'route': {
      return <RouteLayerProperties layer={layer} onAppearanceChange={onAppearanceChange} onRouteVertexChange={onRouteVertexChange} />;
    }
    case 'poi': {
      return <PoiLayerProperties layer={layer} assets={assets} onAppearanceChange={onAppearanceChange} onPoiCoordinatesChange={onPoiCoordinatesChange} onPoiCustomMarkerChange={onPoiCustomMarkerChange} />;
    }
    case 'shape': {
      if (layer.appearance?.kind !== 'shape') return null;
      return (
        <>
          <PropertySection title="Appearance">
            <ShapeAppearanceControls key={`${layer.id}-${layer.appearance.strokeWidth}`} appearance={layer.appearance} onChange={onAppearanceChange} />
          </PropertySection>
          {layer.geometry?.type === 'Polygon' && (
            <PropertySection title="Vertices">
              <ShapeVertexControls key={layer.id} coordinates={layer.geometry.coordinates} onChange={onShapeVertexChange} />
            </PropertySection>
          )}
          {layer.geometry?.type === 'MultiPolygon' && (
            <MultiPartGeometryStatus partCount={layer.geometry.coordinates.length} />
          )}
        </>
      );
    }
    default: {
      return null;
    }
  }
}

export function LayerProperties({
  layer,
  assets,
  onRename,
  onOpacityChange,
  onAppearanceChange,
  onPoiCoordinatesChange,
  onPoiCustomMarkerChange,
  onRouteVertexChange,
  onShapeVertexChange,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onDelete,
}: LayerPropertiesProps) {
  const [nameEdit, setNameEdit] = useState(() => ({ source: layer.name, value: layer.name }));
  const [opacityEdit, setOpacityEdit] = useState(() => ({ source: layer.opacity, value: String(layer.opacity) }));
  const nameDraft = nameEdit.source === layer.name ? nameEdit.value : layer.name;
  const opacityDraft = opacityEdit.source === layer.opacity ? opacityEdit.value : String(layer.opacity);
  const commitName = () => {
    const name = nameDraft.trim();
    if (!name) {
      setNameEdit({ source: layer.name, value: layer.name });
      return;
    }
    setNameEdit({ source: name, value: name });
    onRename(name);
  };
  const commitOpacity = () => {
    const opacity = Number(opacityDraft);
    if (opacityDraft.trim() === '' || !Number.isFinite(opacity)) {
      setOpacityEdit({ source: layer.opacity, value: String(layer.opacity) });
      return;
    }
    const clampedOpacity = Math.max(0, Math.min(100, opacity));
    setOpacityEdit({ source: clampedOpacity, value: String(clampedOpacity) });
    onOpacityChange(clampedOpacity);
  };

  return (
    <div className="properties-panel">
      <div className="properties-title">
        <div><span className="eyebrow">Layer properties</span><h2>{layer.name}</h2></div>
        <LayerMenu onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
      <PropertySection title="Layer">
        <PropertyRow label="Name"><input aria-label="Layer name" value={nameDraft} onChange={(event) => setNameEdit({ source: layer.name, value: event.target.value })} onBlur={commitName} /></PropertyRow>
        <PropertyRow label="Opacity"><label className="number-field"><input aria-label="Layer opacity" value={opacityDraft} onChange={(event) => setOpacityEdit({ source: layer.opacity, value: event.target.value })} onBlur={commitOpacity} /><small>%</small></label></PropertyRow>
        <PropertyRow label="Visible"><button aria-label="Toggle layer visibility" className={`toggle${layer.visible ? ' is-on' : ''}`} type="button" aria-pressed={layer.visible} onClick={onToggleVisibility}><span /></button></PropertyRow>
        <PropertyRow label="Locked"><button aria-label="Toggle layer lock" className={`toggle${layer.locked ? ' is-on' : ''}`} type="button" aria-pressed={layer.locked} onClick={onToggleLock}><span /></button></PropertyRow>
      </PropertySection>
      <LayerTypeProperties layer={layer} assets={assets} onAppearanceChange={onAppearanceChange} onPoiCoordinatesChange={onPoiCoordinatesChange} onPoiCustomMarkerChange={onPoiCustomMarkerChange} onRouteVertexChange={onRouteVertexChange} onShapeVertexChange={onShapeVertexChange} />
    </div>
  );
}
