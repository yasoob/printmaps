import type { LucideIcon } from 'lucide-react';
import { memo, useRef } from 'react';

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

export const StudioModeTabs = memo(function StudioModeTabs<Value extends string>({ choices, value, onValueChange, label, idPrefix, panelId, disabled, className }: StudioModeTabsProps<Value>) {
  const listRef = useRef<HTMLDivElement>(null);
  return <div ref={listRef} className={`studio-mode-tabs studio-segmented${className ? ` ${className}` : ''}`} role="tablist" aria-label={label} onKeyDown={(event) => {
    if (disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = choices.findIndex((choice) => choice.value === value);
    const adjacent = (current + (event.key === 'ArrowLeft' ? -1 : 1) + choices.length) % choices.length;
    const boundary = event.key === 'Home' ? 0 : choices.length - 1;
    const index = event.key === 'Home' || event.key === 'End' ? boundary : adjacent;
    const next = choices[index];
    if (!next) return;
    onValueChange(next.value, { source: 'keyboard' });
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  }}>
    {choices.map((choice) => <button key={choice.value} id={`${idPrefix}-${choice.value}-tab`} type="button" role="tab"
      aria-selected={value === choice.value} aria-controls={panelId ?? `${idPrefix}-${choice.value}-panel`}
      tabIndex={value === choice.value ? 0 : -1} disabled={disabled} aria-label={choice.ariaLabel}
      onClick={(event) => onValueChange(choice.value, { source: event.detail === 0 ? 'keyboard' : 'pointer' })}>
      {choice.icon && <choice.icon aria-hidden="true" size={16} strokeWidth={1.75} />}
      {/* The compact label is CSS-generated so it never joins the tab's text or accessible name. */}
      <span className="studio-segmented-label" data-short-label={choice.shortLabel}>
        {choice.shortLabel ? <span className="studio-segmented-label-full">{choice.label}</span> : choice.label}
      </span>
    </button>)}
  </div>;
}) as <Value extends string>(props: StudioModeTabsProps<Value>) => React.JSX.Element;
