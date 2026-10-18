import { memo, useId } from 'react';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { ColorField } from '../../components/ui/color-field';
import { ValidatedNumberField } from '../components/ValidatedNumberField';
import { PropertyRow } from '../components/PropertyControls';
import { Checkbox } from '../components/UiControls';

/**
 * `label` is always the accessible name (tests and probes key on it); `rowLabel` optionally
 * shortens the visible row text, e.g. label "Compass corner" with rowLabel "Corner".
 */
type StudioFieldLabels = { label: string; rowLabel?: string };

export const StudioToggle = memo(function StudioToggle({ label, rowLabel, checked, onChange, disabled = false }: StudioFieldLabels & {
  checked: boolean; onChange: (isChecked: boolean) => void; disabled?: boolean;
}) {
  return <Checkbox label={rowLabel ?? label} aria-label={rowLabel ? label : undefined} isChecked={checked} disabled={disabled} onCheckedChange={onChange} />;
});

export const StudioColor = memo(function StudioColor({ label, rowLabel, value, onChange, disabled }: StudioFieldLabels & {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  return <PropertyRow label={rowLabel ?? label}><ColorField label={label} value={value} disabled={disabled} onChange={onChange} /></PropertyRow>;
});

type StudioSelectProps<T extends string> = StudioFieldLabels & {
  value: T; options: readonly Readonly<{ value: T; label: string }>[]; onChange: (value: T) => void; disabled?: boolean;
};
export const StudioSelect = memo(function StudioSelect<T extends string>({ label, rowLabel, value, options, onChange, disabled }: StudioSelectProps<T>) {
  const id = useId();
  return <PropertyRow label={rowLabel ?? label}><select id={id} aria-label={label} value={value} disabled={disabled} onChange={(event) => {
    const selected = options.find((option) => option.value === event.target.value);
    if (selected) onChange(selected.value);
  }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></PropertyRow>;
}) as <T extends string>(props: StudioSelectProps<T>) => React.JSX.Element;

export const StudioNumber = memo(function StudioNumber({ label, rowLabel, value, min = 0, max = 100, unit = 'mm', epoch, onChange }: StudioFieldLabels & {
  value: number; min?: number; max?: number; unit?: string; epoch: number; onChange: (value: number) => ProjectMutationResult;
}) {
  return <PropertyRow label={rowLabel ?? label}><ValidatedNumberField label={label} value={value} minimum={min} maximum={max} step={0.5} unit={unit} resetKey={epoch} onCommit={onChange} /></PropertyRow>;
});
