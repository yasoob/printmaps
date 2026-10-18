import {
  InputGroup as InputGroupPrimitive,
  InputGroupAddon as InputGroupAddonPrimitive,
  InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

const InputGroupContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

/**
Numeric field on shadcn InputGroup: one field surface with optional unit/prefix addons.
*/
export function InputGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <InputGroupContext value={rootRef}>
      <InputGroupPrimitive ref={rootRef} className={cn('input-group', className)} {...props} />
    </InputGroupContext>
  );
}

export const InputNumber = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function InputNumber({ className, ...props }, ref) {
    return <InputGroupInput ref={ref} className={cn('input-number', className)} type="number" {...props} />;
  },
);

type InputGroupAddonProps = HTMLAttributes<HTMLDivElement> & {
  acceleration?: boolean;
  align?: 'inline-start' | 'inline-end';
  enableScrubbing?: boolean;
  sensitivity?: number;
};

function numericAttribute(input: HTMLInputElement, name: 'min' | 'max' | 'step', fallback: number) {
  const attribute = input.getAttribute(name);
  if ([null, '', 'any'].includes(attribute)) return fallback;
  const value = Number(attribute);
  return Number.isFinite(value) ? value : fallback;
}

function decimalPlaces(value: number) {
  const match = String(value).toLowerCase().match(/^[+-]?\d+(?:\.(\d*))?(?:e([+-]?\d+))?$/);
  if (!match) return 0;
  const fractionLength = match[1]?.length ?? 0;
  const exponent = Number(match[2] ?? 0);
  return Math.max(0, fractionLength - exponent);
}

function setNativeInputValue(input: HTMLInputElement, value: number, precision: number) {
  const next = Number(precision <= 100 ? value.toFixed(precision) : value.toPrecision(15));
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, String(next));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return next;
}

function canStartScrubbing(isScrubbingEnabled: boolean, event: ReactPointerEvent<HTMLDivElement>) {
  return isScrubbingEnabled && !event.defaultPrevented && event.button === 0;
}

export function InputGroupAddon({
  acceleration = false,
  align = 'inline-start',
  className,
  enableScrubbing = false,
  sensitivity = 4,
  onPointerDown,
  ...props
}: InputGroupAddonProps) {
  const groupRef = useContext(InputGroupContext);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const startScrubbing = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerDown?.(event);
    if (!canStartScrubbing(enableScrubbing, event)) return;
    cleanupRef.current?.();
    const input = groupRef?.current?.querySelector<HTMLInputElement>('input[type="number"]');
    const startValue = Number(input?.value);
    if (!input || input.disabled || !Number.isFinite(startValue)) return;
    event.preventDefault();
    const addon = event.currentTarget;

    const minimum = numericAttribute(input, 'min', -Infinity);
    const maximum = numericAttribute(input, 'max', Infinity);
    const step = Math.abs(numericAttribute(input, 'step', 1)) || 1;
    const pixelsPerStep = Math.max(0.01, sensitivity);
    const precision = Math.max(decimalPlaces(startValue), decimalPlaces(step));
    const startX = event.clientX;
    const pointerId = event.pointerId;
    let lastValue = startValue;
    input.focus({ preventScroll: true });
    document.body.classList.add('is-number-scrubbing');
    addon.dataset.scrubbing = 'true';

    const move = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      const distance = pointerEvent.clientX - startX;
      const multiplier = acceleration ? Math.max(1, Math.floor(Math.abs(distance) / 80) + 1) : 1;
      const delta = Math.round(distance / pixelsPerStep) * step * multiplier;
      const next = Math.min(maximum, Math.max(minimum, startValue + delta));
      if (next !== lastValue) lastValue = setNativeInputValue(input, next, precision);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      document.body.classList.remove('is-number-scrubbing');
      delete addon.dataset.scrubbing;
      cleanupRef.current = null;
    };
    const finish = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      cleanup();
      input.blur();
    };
    cleanupRef.current = cleanup;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  return (
    <InputGroupAddonPrimitive
      aria-hidden="true"
      role={undefined}
      align={align}
      className={cn('input-group-addon', `is-${align}`, enableScrubbing ? 'is-scrubbable' : undefined, className)}
      title={enableScrubbing ? 'Drag horizontally to adjust' : undefined}
      onPointerDown={startScrubbing}
      {...props}
    />
  );
}
