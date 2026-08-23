import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { decodeCustomMarkerImage, validateCustomMarkerFile, type CustomMarkerAsset } from '../../domain/customMarkerAssets';
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
  customAsset?: CustomMarkerAsset;
  onChange: (appearance: PoiAppearance) => void;
  onCustomMarkerChange: (asset: CustomMarkerAsset | null) => void;
};

function customMarkerActionLabel(isPending: boolean, customAsset?: CustomMarkerAsset): string {
  if (isPending) return 'Checking…';
  return customAsset ? 'Replace marker' : 'Upload marker';
}

function CustomMarkerControl({
  customAsset,
  onChange,
}: {
  customAsset?: CustomMarkerAsset;
  onChange: (asset: CustomMarkerAsset | null) => void;
}) {
  const [state, setState] = useState<{ error: string | null; pending: boolean }>({ error: null, pending: false });
  const uploadSequence = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { uploadSequence.current += 1; }, []);
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const sequence = uploadSequence.current + 1;
    uploadSequence.current = sequence;
    setState({ error: null, pending: true });
    try {
      const asset = await validateCustomMarkerFile(file);
      const decoded = await decodeCustomMarkerImage(asset);
      if ('close' in decoded && typeof decoded.close === 'function') decoded.close();
      if (uploadSequence.current !== sequence) return;
      setState({ error: null, pending: false });
      onChange(asset);
    } catch (error) {
      if (uploadSequence.current !== sequence) return;
      setState({
        error: error instanceof Error ? error.message : 'The custom marker could not be opened.',
        pending: false,
      });
    }
  };
  const removeMarker = () => {
    uploadSequence.current += 1;
    setState({ error: null, pending: false });
    onChange(null);
  };
  return (
    <div className="custom-marker-control">
      <button className="secondary-action" type="button" disabled={state.pending} aria-label={`${customAsset ? 'Replace' : 'Upload'} custom marker`} onClick={() => fileInputRef.current?.click()}><ImagePlus size={14} /> {customMarkerActionLabel(state.pending, customAsset)}</button>
      <input ref={fileInputRef} aria-label="Custom marker file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" disabled={state.pending} hidden type="file" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        void handleFile(file);
      }} />
      {customAsset && <button className="secondary-action" type="button" aria-label="Remove custom marker" onClick={removeMarker}><Trash2 size={14} /> Remove</button>}
      {customAsset && <div role="status" aria-label="Custom marker status">Custom marker · {customAsset.width} × {customAsset.height}px</div>}
      {state.error && <div role="alert" aria-label="Custom marker error">{state.error}</div>}
    </div>
  );
}

export function PoiAppearanceControls({ appearance, customAsset, onChange, onCustomMarkerChange }: PoiAppearanceControlsProps) {
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
      <CustomMarkerControl customAsset={customAsset} onChange={onCustomMarkerChange} />
    </>
  );
}
