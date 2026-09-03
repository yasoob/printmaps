import { memo, useState } from 'react';
import type {
  RouteAppearance,
  RouteMarkerAppearance,
  RouteSegmentStyleOverride,
} from '../../domain/project';
import {
  ROUTE_TRAVEL_MARKERS,
  ROUTE_TRAVEL_MARKER_LABELS,
  markerAppearanceFor,
  type RouteTravelMarker,
} from '../../domain/routeProfiles';
import { InputGroup, InputGroupAddon, InputNumber } from './InputGroup';
import { PropertyRow } from './PropertyControls';
import { Checkbox, Switch } from './UiControls';

function percent(value: number) {
  return Number((value * 100).toFixed(4));
}

function markerForPictogram(
  current: RouteMarkerAppearance | null,
  pictogram: string,
) {
  if (pictogram === 'none') return null;
  if (current) {
    return { ...current, pictogram: pictogram as RouteTravelMarker };
  }
  return markerAppearanceFor(pictogram as RouteTravelMarker);
}

function markerPlacement(type: string): RouteMarkerAppearance['placement'] {
  if (type === 'center') return { type: 'center' };
  if (type === 'fraction') return { type: 'fraction', fraction: 0.5 };
  return { type: 'repeat', spacing: 0.2 };
}

function RouteMarkerSettings({
  disabled,
  marker,
  updateMarker,
}: {
  disabled: boolean;
  marker: RouteMarkerAppearance;
  updateMarker: (next: Partial<RouteMarkerAppearance>) => void;
}) {
  return (
    <>
      <PropertyRow label="Placement per segment">
        <select
          aria-label="Route marker placement"
          disabled={disabled}
          value={marker.placement.type}
          onChange={(event) => updateMarker({
            placement: markerPlacement(event.currentTarget.value),
          })}
        >
          <option value="center">Segment center</option>
          <option value="fraction">Same position per segment</option>
          <option value="repeat">Repeat per segment</option>
        </select>
      </PropertyRow>
      {marker.placement.type === 'fraction' ? (
        <PropertyRow label="Position">
          <InputGroup>
            <InputNumber
              aria-label="Route marker position percentage"
              disabled={disabled}
              min={0}
              max={100}
              step={1}
              value={percent(marker.placement.fraction)}
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                if (Number.isFinite(value) && value >= 0 && value <= 100) {
                  updateMarker({ placement: { type: 'fraction', fraction: value / 100 } });
                }
              }}
            />
            <InputGroupAddon align="inline-end">%</InputGroupAddon>
          </InputGroup>
        </PropertyRow>
      ) : null}
      {marker.placement.type === 'repeat' ? (
        <PropertyRow label="Spacing">
          <InputGroup>
            <InputNumber
              aria-label="Route marker repeat spacing percentage"
              disabled={disabled}
              min={1}
              max={100}
              step={1}
              value={percent(marker.placement.spacing)}
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                if (Number.isFinite(value) && value > 0 && value <= 100) {
                  updateMarker({ placement: { type: 'repeat', spacing: value / 100 } });
                }
              }}
            />
            <InputGroupAddon align="inline-end">%</InputGroupAddon>
          </InputGroup>
        </PropertyRow>
      ) : null}
      <Switch
        aria-label="Orient route marker to path"
        disabled={disabled}
        isChecked={marker.orientToPath}
        label="Orient to path"
        onCheckedChange={(orientToPath) => updateMarker({
          orientToPath,
          ...(!orientToPath && { reverseFacing: false }),
        })}
      />
      {marker.orientToPath ? (
        <Switch
          aria-label="Reverse route marker facing"
          disabled={disabled}
          isChecked={marker.reverseFacing}
          label="Reverse facing"
          onCheckedChange={(reverseFacing) => updateMarker({ reverseFacing })}
        />
      ) : null}
    </>
  );
}

export const RouteMarkerControls = memo(function RouteMarkerControls({
  appearance,
  disabled,
  onChange,
}: {
  appearance: RouteAppearance;
  disabled: boolean;
  onChange: (appearance: RouteAppearance) => void;
}) {
  const marker = appearance.marker;
  const update = (next: RouteMarkerAppearance | null) => onChange({ ...appearance, marker: next });
  const updateMarker = (next: Partial<RouteMarkerAppearance>) => {
    if (marker) update({ ...marker, ...next });
  };
  return (
    <>
      <PropertyRow label="Pictogram">
        <select
          aria-label="Route marker pictogram"
          disabled={disabled}
          value={marker?.pictogram ?? 'none'}
          onChange={(event) => {
            const pictogram = event.currentTarget.value;
            update(markerForPictogram(marker, pictogram));
          }}
        >
          <option value="none">None</option>
          {ROUTE_TRAVEL_MARKERS.map((pictogram) => (
            <option key={pictogram} value={pictogram}>{ROUTE_TRAVEL_MARKER_LABELS[pictogram]}</option>
          ))}
        </select>
      </PropertyRow>
      {marker
        ? <RouteMarkerSettings disabled={disabled} marker={marker} updateMarker={updateMarker} />
        : null}
    </>
  );
});

function normalizedOverride(override: RouteSegmentStyleOverride): RouteSegmentStyleOverride | null {
  return Object.keys(override).length === 0 ? null : override;
}

export const RouteSegmentControls = memo(function RouteSegmentControls({
  appearance,
  disabled,
  onChange,
}: {
  appearance: RouteAppearance;
  disabled: boolean;
  onChange: (appearance: RouteAppearance) => void;
}) {
  const [selectedLeg, setSelectedLeg] = useState(0);
  if (appearance.segmentStyles.length === 0) return <p className="property-note">This route has no semantic legs.</p>;
  const legIndex = Math.min(selectedLeg, Math.max(0, appearance.segmentStyles.length - 1));
  const override = appearance.segmentStyles[legIndex];
  const updateOverride = (next: RouteSegmentStyleOverride | null) => {
    const segmentStyles = appearance.segmentStyles.map((style, index) => (
      index === legIndex ? normalizedOverride(next ?? {}) : style
    ));
    onChange({ ...appearance, segmentStyles });
  };
  const updateField = <Key extends keyof RouteSegmentStyleOverride>(
    key: Key,
    value: RouteSegmentStyleOverride[Key] | undefined,
  ) => {
    const next = override ? { ...override } : {};
    if (value === undefined) delete next[key];
    else next[key] = value;
    updateOverride(next);
  };
  return (
    <>
      <PropertyRow label="Leg">
        <select
          aria-label="Route semantic leg"
          disabled={disabled}
          value={legIndex}
          onChange={(event) => setSelectedLeg(Number(event.currentTarget.value))}
        >
          {appearance.segmentStyles.map((_style, index) => (
            <option key={index} value={index}>Leg {index + 1}</option>
          ))}
        </select>
      </PropertyRow>
      <Checkbox
        aria-label="Inherit route segment color"
        disabled={disabled}
        isChecked={override?.color === undefined}
        label="Inherit route color"
        onCheckedChange={(inherit) => updateField('color', inherit ? undefined : appearance.color)}
      />
      {override?.color === undefined ? null : (
        <PropertyRow label="Color">
          <label className="color-field">
            <input
              aria-label="Route segment color"
              disabled={disabled}
              type="color"
              value={override.color}
              onChange={(event) => updateField('color', event.currentTarget.value)}
            />
          </label>
        </PropertyRow>
      )}
      <Checkbox
        aria-label="Inherit route segment width"
        disabled={disabled}
        isChecked={override?.width === undefined}
        label="Inherit route width"
        onCheckedChange={(inherit) => updateField('width', inherit ? undefined : appearance.width)}
      />
      {override?.width === undefined ? null : (
        <PropertyRow label="Width">
          <InputGroup>
            <InputNumber
              aria-label="Route segment width"
              disabled={disabled}
              min={0}
              step={0.5}
              value={override.width}
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                if (event.currentTarget.value.trim() !== '' && Number.isFinite(value) && value >= 0) {
                  updateField('width', value);
                }
              }}
            />
            <InputGroupAddon align="inline-end">px</InputGroupAddon>
          </InputGroup>
        </PropertyRow>
      )}
      <Checkbox
        aria-label="Inherit route segment line style"
        disabled={disabled}
        isChecked={override?.strokeStyle === undefined}
        label="Inherit line style"
        onCheckedChange={(inherit) => updateField(
          'strokeStyle',
          inherit ? undefined : appearance.strokeStyle,
        )}
      />
      {override?.strokeStyle === undefined ? null : (
        <PropertyRow label="Line">
          <select
            aria-label="Route segment line style"
            disabled={disabled}
            value={override.strokeStyle}
            onChange={(event) => updateField('strokeStyle', event.currentTarget.value as 'solid' | 'dashed')}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
          </select>
        </PropertyRow>
      )}
      <button className="route-segment-clear" type="button" disabled={disabled || override === null} onClick={() => updateOverride(null)}>
        Clear leg override
      </button>
    </>
  );
});
