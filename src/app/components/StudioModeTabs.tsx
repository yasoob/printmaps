import { memo, useRef } from 'react';
import './studioModeTabs.css';

type StudioModeTabsProps<Value extends string> = {
  choices: readonly Readonly<{ value: Value; label: string }>[];
  value: Value;
  onValueChange: (value: Value) => void;
  label: string;
  idPrefix: string;
  panelId?: string;
  disabled?: boolean;
};

export const StudioModeTabs = memo(function StudioModeTabs<Value extends string>({ choices, value, onValueChange, label, idPrefix, panelId, disabled }: StudioModeTabsProps<Value>) {
  const listRef = useRef<HTMLDivElement>(null);
  return <div ref={listRef} className="studio-mode-tabs" role="tablist" aria-label={label} onKeyDown={(event) => {
    if (disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = choices.findIndex((choice) => choice.value === value);
    const adjacent = (current + (event.key === 'ArrowLeft' ? -1 : 1) + choices.length) % choices.length;
    const boundary = event.key === 'Home' ? 0 : choices.length - 1;
    const index = event.key === 'Home' || event.key === 'End' ? boundary : adjacent;
    const next = choices[index];
    if (!next) return;
    onValueChange(next.value);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  }}>
    {choices.map((choice) => <button key={choice.value} id={`${idPrefix}-${choice.value}-tab`} type="button" role="tab"
      aria-selected={value === choice.value} aria-controls={panelId ?? `${idPrefix}-${choice.value}-panel`}
      tabIndex={value === choice.value ? 0 : -1} disabled={disabled} onClick={() => onValueChange(choice.value)}>
      {choice.label}
    </button>)}
  </div>;
}) as <Value extends string>(props: StudioModeTabsProps<Value>) => React.JSX.Element;
