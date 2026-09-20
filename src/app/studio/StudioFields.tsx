import { useId } from 'react';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { ValidatedNumberField } from '../components/ValidatedNumberField';

export function StudioToggle({ label, checked, onChange, disabled = false }: {
  label: string; checked: boolean; onChange: (isChecked: boolean) => void; disabled?: boolean;
}) {
  return <label className="studio-composition-toggle"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

export function StudioColor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="studio-composition-color"><span>{label}</span><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function StudioSelect<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly Readonly<{ value: T; label: string }>[]; onChange: (value: T) => void;
}) {
  const id = useId();
  return <label className="studio-composition-field" htmlFor={id}><span>{label}</span><select id={id} value={value} onChange={(event) => {
    const selected = options.find((option) => option.value === event.target.value);
    if (selected) onChange(selected.value);
  }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

export function StudioNumber({ label, value, min = 0, max = 100, unit = 'mm', epoch, onChange }: {
  label: string; value: number; min?: number; max?: number; unit?: string; epoch: number; onChange: (value: number) => ProjectMutationResult;
}) {
  return <label className="studio-composition-number"><span>{label}</span><ValidatedNumberField label={label} value={value} minimum={min} maximum={max} step={0.5} unit={unit} resetKey={epoch} onCommit={onChange} /></label>;
}
