import { Check } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode } from 'react';

type SharedControlProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'className' | 'onChange' | 'type'> & Readonly<{
  isChecked: boolean;
  className?: string;
  label: ReactNode;
  labelHidden?: boolean;
  onCheckedChange?: (isChecked: boolean) => void;
}>;

function controlClassName(base: string, className?: string): string {
  return className ? `${base} ${className}` : base;
}

export function Checkbox({ isChecked, className, label, labelHidden = false, onCheckedChange, ...inputProps }: SharedControlProps) {
  return (
    <label className={controlClassName('studio-checkbox', className)}>
      <input
        {...inputProps}
        className="studio-checkbox-native"
        type="checkbox"
        checked={isChecked}
        onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
      />
      <span className="studio-checkbox-box" aria-hidden="true"><Check size={12} strokeWidth={2.5} /></span>
      <span className={labelHidden ? 'sr-only' : 'studio-control-label'}>{label}</span>
    </label>
  );
}

export function Switch({ isChecked, className, label, labelHidden = false, onCheckedChange, ...inputProps }: SharedControlProps) {
  return (
    <label className={controlClassName('studio-switch', className)}>
      <input
        {...inputProps}
        className="studio-switch-native"
        type="checkbox"
        role="switch"
        checked={isChecked}
        onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
      />
      <span className="studio-switch-track" aria-hidden="true"><span /></span>
      <span className={labelHidden ? 'sr-only' : 'studio-control-label'}>{label}</span>
    </label>
  );
}
