import type { LucideIcon } from 'lucide-react';
import { memo, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type StudioModeTabChoice<Value extends string> = Readonly<{
  value: Value;
  label: string;
  // Optional compact label shown instead of `label` when the surface is narrow.
  shortLabel?: string;
  // Accessible name when it should differ from the visible label.
  ariaLabel?: string;
  icon?: LucideIcon;
}>;

export type StudioModeTabActivation = Readonly<{ source: 'pointer' | 'keyboard' }>;

type StudioModeTabsProps<Value extends string> = {
  choices: readonly StudioModeTabChoice<Value>[];
  value: Value;
  onValueChange: (value: Value, activation: StudioModeTabActivation) => void;
  label: string;
  idPrefix: string;
  panelId?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Panel switcher on shadcn Tabs (tab semantics; arrow keys and Home/End activate with focus).
 * The caller renders the panels: tabs have ids `${idPrefix}-${value}-tab` and point at `panelId`
 * or `${idPrefix}-${value}-panel`. Shares the `.studio-segmented` visual with SegmentedControl.
 */
export const StudioModeTabs = memo(function StudioModeTabs<Value extends string>({ choices, value, onValueChange, label, idPrefix, panelId, disabled, className }: StudioModeTabsProps<Value>) {
  // The last input modality decides whether an activation came from a pointer or the keyboard.
  const pointerActivation = useRef(false);
  return (
    <Tabs
      value={value}
      className="contents"
      onValueChange={(next) => {
        if (next === value) return;
        onValueChange(next as Value, { source: pointerActivation.current ? 'pointer' : 'keyboard' });
      }}
    >
      <TabsList
        className={cn('studio-mode-tabs', className)}
        aria-label={label}
        activateOnFocus
        loopFocus
        onPointerDown={() => { pointerActivation.current = true; }}
        onKeyDown={() => { pointerActivation.current = false; }}
      >
        {choices.map((choice) => (
          <TabsTrigger
            key={choice.value}
            value={choice.value}
            id={`${idPrefix}-${choice.value}-tab`}
            aria-controls={panelId ?? `${idPrefix}-${choice.value}-panel`}
            aria-label={choice.ariaLabel}
            disabled={disabled}
          >
            {choice.icon && <choice.icon aria-hidden="true" size={16} strokeWidth={1.75} />}
            {/* The compact label is CSS-generated so it never joins the tab's text or accessible name. */}
            <span className="studio-segmented-label" data-short-label={choice.shortLabel}>
              {choice.shortLabel ? <span className="studio-segmented-label-full">{choice.label}</span> : choice.label}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}) as <Value extends string>(props: StudioModeTabsProps<Value>) => React.JSX.Element;
