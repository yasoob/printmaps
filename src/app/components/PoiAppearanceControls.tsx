import { useState } from 'react';
import type { PoiAppearance } from '../../domain/project';
import {
  isPoiLabelValid,
  POI_MARKER_SHAPES,
  POI_MARKER_SHAPE_LABELS,
  POI_MARKER_SYMBOLS,
  POI_MARKER_SYMBOL_LABELS,
  type PoiMarkerShape,
  type PoiMarkerSymbol,
} from '../../domain/poiMarkers';
import { PropertyRow } from './PropertyControls';

type PoiAppearanceControlsProps = {
  appearance: PoiAppearance;
  onChange: (appearance: PoiAppearance) => void;
};

export function PoiAppearanceControls({ appearance, onChange }: PoiAppearanceControlsProps) {
  const [sizeEdit, setSizeEdit] = useState(() => ({
    source: appearance.size,
    value: String(appearance.size),
  }));
  const [labelEdit, setLabelEdit] = useState(() => ({
    source: appearance.label,
    value: appearance.label,
  }));
  const sizeDraft = sizeEdit.source === appearance.size ? sizeEdit.value : String(appearance.size);
  const sizeValue = Number(sizeDraft);
  const isSizeInvalid = sizeDraft.trim() === ''
    || !Number.isFinite(sizeValue)
    || sizeValue < 8
    || sizeValue > 48;
  const labelDraft = labelEdit.source === appearance.label ? labelEdit.value : appearance.label;
  const commitSize = (value: string) => {
    const size = Number(value);
    if (value.trim() === '' || !Number.isFinite(size) || size < 8 || size > 48) {
      setSizeEdit({ source: appearance.size, value: String(appearance.size) });
      return;
    }
    setSizeEdit({ source: size, value: String(size) });
    onChange({ ...appearance, size });
  };
  const commitLabel = (value: string) => {
    const label = value.trim();
    if (!isPoiLabelValid(label)) {
      setLabelEdit({ source: appearance.label, value: appearance.label });
      return;
    }
    setLabelEdit({ source: label, value: label });
    onChange({ ...appearance, label });
  };

  return (
    <>
      <PropertyRow label="Color"><label className="color-field"><input aria-label="POI color" type="color" value={appearance.color} onChange={(event) => onChange({ ...appearance, color: event.target.value })} /></label></PropertyRow>
      <PropertyRow label="Size"><label className="number-field"><input aria-label="POI marker size" aria-invalid={isSizeInvalid || undefined} value={sizeDraft} onChange={(event) => setSizeEdit({ source: appearance.size, value: event.target.value })} onBlur={(event) => commitSize(event.currentTarget.value)} /><small>px</small></label></PropertyRow>
      <PropertyRow label="Shape"><select aria-label="POI marker shape" value={appearance.markerShape} onChange={(event) => onChange({ ...appearance, markerShape: event.target.value as PoiMarkerShape })}>{POI_MARKER_SHAPES.map((shape) => <option key={shape} value={shape}>{POI_MARKER_SHAPE_LABELS[shape]}</option>)}</select></PropertyRow>
      <PropertyRow label="Symbol"><select aria-label="POI marker symbol" value={appearance.markerSymbol} onChange={(event) => onChange({ ...appearance, markerSymbol: event.target.value as PoiMarkerSymbol })}>{POI_MARKER_SYMBOLS.map((symbol) => <option key={symbol} value={symbol}>{POI_MARKER_SYMBOL_LABELS[symbol]}</option>)}</select></PropertyRow>
      <PropertyRow label="Label"><input aria-label="POI label" aria-invalid={!isPoiLabelValid(labelDraft) || undefined} value={labelDraft} onChange={(event) => setLabelEdit({ source: appearance.label, value: event.target.value })} onBlur={(event) => commitLabel(event.currentTarget.value)} /></PropertyRow>
    </>
  );
}
