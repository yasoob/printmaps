import { memo, useId } from 'react';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { ValidatedNumberField } from '../components/ValidatedNumberField';
import { PropertyRow } from '../components/PropertyControls';
import { Checkbox } from '../components/UiControls';

export const StudioToggle = memo(function StudioToggle({ label, checked, onChange, disabled = false }: {
  label: string; checked: boolean; onChange: (isChecked: boolean) => void; disabled?: boolean;
}) {
  return <Checkbox label={label} isChecked={checked} disabled={disabled} onCheckedChange={onChange} />;
});

export const StudioColor = memo(function StudioColor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <PropertyRow label={label}><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} /></PropertyRow>;
});

type StudioSelectProps<T extends string> = {
  label: string; value: T; options: readonly Readonly<{ value: T; label: string }>[]; onChange: (value: T) => void;
};
export const StudioSelect = memo(function StudioSelect<T extends string>({ label, value, options, onChange }: StudioSelectProps<T>) {
  const id = useId();
  return <PropertyRow label={label}><select id={id} aria-label={label} value={value} onChange={(event) => {
    const selected = options.find((option) => option.value === event.target.value);
    if (selected) onChange(selected.value);
  }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></PropertyRow>;
}) as <T extends string>(props: StudioSelectProps<T>) => React.JSX.Element;

export const StudioNumber = memo(function StudioNumber({ label, value, min = 0, max = 100, unit = 'mm', epoch, onChange }: {
  label: string; value: number; min?: number; max?: number; unit?: string; epoch: number; onChange: (value: number) => ProjectMutationResult;
}) {
  return <PropertyRow label={label}><ValidatedNumberField label={label} value={value} minimum={min} maximum={max} step={0.5} unit={unit} resetKey={epoch} onCommit={onChange} /></PropertyRow>;
});
