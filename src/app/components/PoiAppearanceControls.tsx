import { ImagePlus, Trash2 } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
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
import { InputGroup, InputGroupAddon, InputNumber } from './InputGroup';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import './PoiAppearanceControls.css';

type PoiAppearanceControlsProps = {
  appearance: PoiAppearance;
  customAsset?: CustomMarkerAsset;
  onChange: (appearance: PoiAppearance) => ProjectMutationResult;
  onCustomMarkerChange: (asset: CustomMarkerAsset | null) => ProjectMutationResult;
};

function customMarkerActionLabel(isPending: boolean, customAsset?: CustomMarkerAsset): string {
  if (isPending) return 'Checking…';
  return customAsset ? 'Replace marker' : 'Upload marker';
}

function isMarkerSizeInvalid(value: string): boolean {
  const size = Number(value);
  return value.trim() === '' || !Number.isFinite(size) || size < 8 || size > 48;
}

function CustomMarkerControl({
  customAsset,
  onChange,
}: {
  customAsset?: CustomMarkerAsset;
  onChange: (asset: CustomMarkerAsset | null) => ProjectMutationResult;
}) {
  const [state, setState] = useState<{ error: string | null; pending: boolean }>({ error: null, pending: false });
  const uploadSequence = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const helpId = useId();
  useLayoutEffect(() => () => { uploadSequence.current += 1; }, []);
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
      const result = onChange(asset);
      setState({ error: result.ok ? null : result.error, pending: false });
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
    const result = onChange(null);
    setState({ error: result.ok ? null : result.error, pending: false });
  };
  return (
    <div className="custom-marker-control">
      <p id={helpId} className="custom-marker-help">PNG/JPEG: 100–2048 px per side. SVG: scalable, including 24-unit icons. Maximum 1 MiB per file.</p>
      <button className="secondary-action" type="button" disabled={state.pending} aria-describedby={helpId} aria-label={`${customAsset ? 'Replace' : 'Upload'} custom marker`} onClick={() => fileInputRef.current?.click()}><ImagePlus size={14} /> {customMarkerActionLabel(state.pending, customAsset)}</button>
      <input ref={fileInputRef} aria-label="Custom marker file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" disabled={state.pending} hidden type="file" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        void handleFile(file);
      }} />
      {customAsset && <button className="secondary-action" type="button" aria-label="Remove custom marker" onClick={removeMarker}><Trash2 size={14} /> Remove</button>}
      {customAsset && <div role="status" aria-label="Custom marker status">Custom marker · {customAsset.width} × {customAsset.height} {customAsset.mimeType === 'image/svg+xml' ? 'SVG units · Scalable' : 'px'}</div>}
      {state.error && <div role="alert" aria-label="Custom marker error">{state.error}</div>}
    </div>
  );
}

export function PoiAppearanceControls({ appearance, customAsset, onChange: commit, onCustomMarkerChange }: PoiAppearanceControlsProps) {
  const customStyleHelpId = useId();
  const activeAsset = customAsset?.id === appearance.customAssetId ? customAsset : undefined;
  const customStyleDescription = activeAsset ? customStyleHelpId : undefined;
  const feedback = useMutationFeedback(appearance);
  const onChange = (next: PoiAppearance) => feedback.report(commit(next));
  const [sizeEdit, setSizeEdit] = useState(() => ({
    source: appearance.size,
    value: String(appearance.size),
  }));
  const [labelEdit, setLabelEdit] = useState(() => ({
    source: appearance.label,
    value: appearance.label,
  }));

  const sizeDraft = sizeEdit.source === appearance.size ? sizeEdit.value : String(appearance.size);
  const isSizeInvalid = isMarkerSizeInvalid(sizeDraft);
  const labelDraft = labelEdit.source === appearance.label ? labelEdit.value : appearance.label;
  const commitSize = (value: string) => {
    const size = Number(value);
    if (isMarkerSizeInvalid(value)) {
      setSizeEdit({ source: appearance.size, value: String(appearance.size) });
      return;
    }
    const result = onChange({ ...appearance, size });
    if (result.ok) setSizeEdit({ source: size, value: String(size) });
  };
  const commitLabel = (value: string) => {
    const label = value.trim();
    if (!isPoiLabelValid(label)) {
      setLabelEdit({ source: appearance.label, value: appearance.label });
      return;
    }
    const result = onChange({ ...appearance, label });
    if (result.ok) setLabelEdit({ source: label, value: label });
  };


  return (
    <>
      {activeAsset && <p id={customStyleHelpId} className="custom-marker-help">The custom image supplies its own color, shape and symbol. Size, label and opacity still apply. Remove it to restore your standard marker style.</p>}
      <PropertyRow label="Color"><label className="color-field"><input aria-label="POI color" disabled={!!activeAsset} aria-describedby={customStyleDescription} type="color" value={appearance.color} onChange={(event) => onChange({ ...appearance, color: event.target.value })} /></label></PropertyRow>
      <PropertyRow label="Size"><InputGroup><InputNumber aria-label="POI marker size" aria-invalid={isSizeInvalid || undefined} min={8} max={48} step={1} value={sizeDraft} onChange={(event) => setSizeEdit({ source: appearance.size, value: event.target.value })} onBlur={(event) => commitSize(event.currentTarget.value)} /><InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>px</InputGroupAddon></InputGroup></PropertyRow>
      <PropertyRow label="Shape"><select aria-label="POI marker shape" disabled={!!activeAsset} aria-describedby={customStyleDescription} value={appearance.markerShape} onChange={(event) => onChange({ ...appearance, markerShape: event.target.value as PoiMarkerShape })}>{POI_MARKER_SHAPES.map((shape) => <option key={shape} value={shape}>{POI_MARKER_SHAPE_LABELS[shape]}</option>)}</select></PropertyRow>
      <PropertyRow label="Symbol"><select aria-label="POI marker symbol" disabled={!!activeAsset} aria-describedby={customStyleDescription} value={appearance.markerSymbol} onChange={(event) => onChange({ ...appearance, markerSymbol: event.target.value as PoiMarkerSymbol })}>{POI_MARKER_SYMBOLS.map((symbol) => <option key={symbol} value={symbol}>{POI_MARKER_SYMBOL_LABELS[symbol]}</option>)}</select></PropertyRow>
      <PropertyRow label="Label"><input aria-label="POI label" aria-invalid={!isPoiLabelValid(labelDraft) || undefined} value={labelDraft} onChange={(event) => setLabelEdit({ source: appearance.label, value: event.target.value })} onBlur={(event) => commitLabel(event.currentTarget.value)} /></PropertyRow>
      {feedback.error && <p className="coordinate-validation" role="alert">{feedback.error}</p>}
      <CustomMarkerControl key={activeAsset?.id ?? 'standard'} customAsset={activeAsset} onChange={onCustomMarkerChange} />
    </>
  );
}
