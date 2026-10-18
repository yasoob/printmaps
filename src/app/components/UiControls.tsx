import { memo, useId, type FocusEventHandler, type ReactNode } from 'react';
import { Checkbox as CheckboxPrimitive } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  /**
  `start` puts the label first and the switch at the trailing edge of a full-width row.
  */
  labelPlacement?: 'end' | 'start';
}>;

/*
 * The label targets the control by id instead of wrapping it: Base UI renders a hidden form input
 * beside the control, and a wrapping label would also name that input (ambiguous label queries).
 */

/**
Multi-select list item on shadcn Checkbox; clicking the visible label toggles it.
*/
export const Checkbox = memo(function Checkbox({ isChecked, className, label, labelHidden = false, onCheckedChange, id, ...controlProps }: SharedControlProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div className={cn('studio-checkbox', className)}>
      <CheckboxPrimitive
        {...controlProps}
        id={controlId}
        className="studio-checkbox-box"
        checked={isChecked}
        onCheckedChange={(checked) => onCheckedChange?.(checked)}
      />
      <Label htmlFor={controlId} className={labelHidden ? 'sr-only' : 'studio-control-label'}>{label}</Label>
    </div>
  );
});

/**
Standalone on/off behaviour on shadcn Switch.
*/
export const Switch = memo(function Switch({ isChecked, className, label, labelHidden = false, labelPlacement = 'end', onCheckedChange, id, ...controlProps }: SwitchProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div className={cn('studio-switch', className)} data-label-placement={labelPlacement}>
      <SwitchPrimitive
        {...controlProps}
        id={controlId}
        className="studio-switch-track"
        checked={isChecked}
        onCheckedChange={(checked) => onCheckedChange?.(checked)}
      />
      <Label htmlFor={controlId} className={labelHidden ? 'sr-only' : 'studio-control-label'}>{label}</Label>
    </div>
  );
});
