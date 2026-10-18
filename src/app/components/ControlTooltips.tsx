import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { Tooltip, TooltipContent } from '@/components/ui/tooltip';

const OPEN_DELAY_MS = 400;
const TOOLTIP_SELECTOR = '[data-tooltip]';

type ActiveTooltip = Readonly<{ element: HTMLElement; label: string; shortcut?: string }>;

function tooltipTarget(target: EventTarget | null, root: HTMLElement) {
  const element = target instanceof Element ? target.closest<HTMLElement>(TOOLTIP_SELECTOR) : null;
  return element && root.contains(element) ? element : null;
}

function describe(element: HTMLElement): ActiveTooltip {
  return { element, label: element.dataset.tooltip ?? '', shortcut: element.dataset.tooltipShortcut };
}

/*
 * One delegated tooltip for imperatively created controls (MapLibre zoom/fit/attribution) that
 * React cannot wrap. Controls opt in with `data-tooltip` (+ optional `data-tooltip-shortcut`)
 * instead of a native `title`. State is local, so showing a hint re-renders only this leaf.
 */
export const ControlTooltips = memo(function ControlTooltips({ rootRef }: Readonly<{ rootRef: RefObject<HTMLElement | null> }>) {
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // While a pointer is pressed (dragging a handle or panning), hints never open mid-gesture.
    let isPointerPressed = false;
    const clear = () => {
      window.clearTimeout(timer.current);
      setActive(null);
    };
    const handlePointerDown = () => {
      isPointerPressed = true;
      clear();
    };
    const handlePointerRelease = () => { isPointerPressed = false; };
    const showLater = (element: HTMLElement) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setActive(describe(element)), OPEN_DELAY_MS);
    };
    const handlePointerOver = (event: PointerEvent) => {
      if (isPointerPressed || event.pointerType !== 'mouse') return;
      const element = tooltipTarget(event.target, root);
      if (element) showLater(element);
    };
    const handlePointerOut = (event: PointerEvent) => {
      const element = tooltipTarget(event.target, root);
      if (element && !element.contains(event.relatedTarget as Node | null)) clear();
    };
    const handleFocusIn = (event: FocusEvent) => {
      const element = tooltipTarget(event.target, root);
      if (!isPointerPressed && element?.matches(':focus-visible')) setActive(describe(element));
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear();
    };
    root.addEventListener('pointerover', handlePointerOver);
    root.addEventListener('pointerout', handlePointerOut);
    root.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerRelease);
    window.addEventListener('pointercancel', handlePointerRelease);
    root.addEventListener('focusin', handleFocusIn);
    root.addEventListener('focusout', clear);
    root.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer.current);
      root.removeEventListener('pointerover', handlePointerOver);
      root.removeEventListener('pointerout', handlePointerOut);
      root.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerRelease);
      window.removeEventListener('pointercancel', handlePointerRelease);
      root.removeEventListener('focusin', handleFocusIn);
      root.removeEventListener('focusout', clear);
      root.removeEventListener('keydown', handleKeyDown);
    };
  }, [rootRef]);

  return (
    <Tooltip open={active !== null && active.element.isConnected} onOpenChange={(open) => { if (!open) setActive(null); }}>
      {active && (
        <TooltipContent anchor={active.element} side="left" showArrow={false}>
          <span>{active.label}</span>
          {active.shortcut && <kbd className="studio-tooltip-shortcut">{active.shortcut}</kbd>}
        </TooltipContent>
      )}
    </Tooltip>
  );
});
