import { memo, useState } from 'react';
import type { ShapeAppearance } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { InputGroup, InputGroupAddon, InputNumber } from './InputGroup';
import { PropertyRow } from './PropertyControls';
import { Switch } from './UiControls';
import { ColorField } from '../../components/ui/color-field';

export const ShapeAppearanceControls = memo(function ShapeAppearanceControls({
  appearance,
  onChange: commit,
}: {
  appearance: ShapeAppearance;
  onChange: (appearance: ShapeAppearance) => ProjectMutationResult;
}) {
  const feedback = useMutationFeedback(appearance);
  const onChange = (next: ShapeAppearance) => feedback.report(commit(next));
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
    const result = onChange({ ...appearance, strokeWidth });
    if (result.ok) setWidthEdit({ source: strokeWidth, value: String(strokeWidth) });
  };

  return (
    <>
      <PropertyRow label="Fill"><ColorField label="Shape fill color" value={appearance.fillColor} onChange={(fillColor) => onChange({ ...appearance, fillColor })} /></PropertyRow>
      <PropertyRow label="Outline"><ColorField label="Shape outline color" value={appearance.strokeColor} onChange={(strokeColor) => onChange({ ...appearance, strokeColor })} /></PropertyRow>
      <PropertyRow label="Width"><InputGroup><InputNumber aria-label="Shape outline width" aria-invalid={isWidthInvalid || undefined} min={0.5} max={12} step={0.5} value={widthDraft} onChange={(event) => setWidthEdit({ source: appearance.strokeWidth, value: event.target.value })} onBlur={(event) => commitWidth(event.currentTarget.value)} /><InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>px</InputGroupAddon></InputGroup></PropertyRow>
      <Switch aria-label="Invert shape fill" labelPlacement="start" isChecked={appearance.invert} label="Invert outside area" onCheckedChange={(isChecked) => onChange({ ...appearance, invert: isChecked })} />
      {feedback.error && <p className="coordinate-validation" role="alert">{feedback.error}</p>}
    </>
  );
}, (previous, next) => previous.appearance === next.appearance);
