import { memo, type FocusEventHandler, type ReactNode } from 'react';
import { Checkbox as CheckboxPrimitive } from '@/components/ui/checkbox';
import { Switch as SwitchPrimitive } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type SharedControlProps = Readonly<{
  isChecked: boolean;
  className?: string;
  label: ReactNode;
  labelHidden?: boolean;
  onCheckedChange?: (isChecked: boolean) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  title?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  'aria-controls'?: string;
  onBlur?: FocusEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
}>;

type SwitchProps = SharedControlProps & Readonly<{
  /** `start` puts the label first and the switch at the trailing edge of a full-width row. */
  labelPlacement?: 'end' | 'start';
}>;

/** Multi-select list item on shadcn Checkbox; the visible label wraps the control so clicks toggle it. */
export const Checkbox = memo(function Checkbox({ isChecked, className, label, labelHidden = false, onCheckedChange, ...controlProps }: SharedControlProps) {
  return (
    <label className={cn('studio-checkbox', className)}>
      <CheckboxPrimitive
        {...controlProps}
        className="studio-checkbox-box"
        checked={isChecked}
        onCheckedChange={(checked) => onCheckedChange?.(checked)}
      />
      <span className={labelHidden ? 'sr-only' : 'studio-control-label'}>{label}</span>
    </label>
  );
});

/** Standalone on/off behaviour on shadcn Switch. */
export const Switch = memo(function Switch({ isChecked, className, label, labelHidden = false, labelPlacement = 'end', onCheckedChange, ...controlProps }: SwitchProps) {
  return (
    <label className={cn('studio-switch', className)} data-label-placement={labelPlacement}>
      <SwitchPrimitive
        {...controlProps}
        className="studio-switch-track"
        checked={isChecked}
        onCheckedChange={(checked) => onCheckedChange?.(checked)}
      />
      <span className={labelHidden ? 'sr-only' : 'studio-control-label'}>{label}</span>
    </label>
  );
});
