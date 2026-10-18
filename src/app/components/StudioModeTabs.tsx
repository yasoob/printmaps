import { memo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type StudioModeTabsProps<Value extends string> = {
  choices: readonly Readonly<{ value: Value; label: string }>[];
  value: Value;
  onValueChange: (value: Value) => void;
  label: string;
  idPrefix: string;
  panelId?: string;
  disabled?: boolean;
};

/**
 * Panel switcher on shadcn Tabs (tab semantics, activation follows focus). The caller renders the
 * panels; tabs point at `panelId` or `${idPrefix}-${value}-panel` and have ids `${idPrefix}-${value}-tab`.
 */
export const StudioModeTabs = memo(function StudioModeTabs<Value extends string>({ choices, value, onValueChange, label, idPrefix, panelId, disabled }: StudioModeTabsProps<Value>) {
  return (
    <Tabs value={value} onValueChange={(next) => { if (next !== value) onValueChange(next as Value); }} className="contents">
      <TabsList className="studio-mode-tabs" aria-label={label} activateOnFocus loopFocus>
        {choices.map((choice) => (
          <TabsTrigger
            key={choice.value}
            value={choice.value}
            id={`${idPrefix}-${choice.value}-tab`}
            aria-controls={panelId ?? `${idPrefix}-${choice.value}-panel`}
            disabled={disabled}
          >
            <span className="studio-segmented-label">{choice.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}) as <Value extends string>(props: StudioModeTabsProps<Value>) => React.JSX.Element;
