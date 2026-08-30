import { Combobox } from '@base-ui/react/combobox';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

type CommonComboboxProps<Value> = Readonly<{
  description: (value: Value) => string;
  disabled?: boolean;
  emptyLabel: string;
  icon: ReactNode;
  inputId?: string;
  itemId: (value: Value) => string;
  itemLabel: (value: Value) => string;
  items: readonly Value[];
  label: string;
  placeholder: string;
}>;

function ComboboxParts<Value>(props: CommonComboboxProps<Value>) {
  return (
    <>
      <Combobox.InputGroup className="shadcn-combobox-input-group">
        {props.icon}
        <Combobox.Input id={props.inputId} aria-label={props.label} placeholder={props.placeholder} />
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner className="shadcn-combobox-positioner" side="bottom" align="start" sideOffset={6}>
          <Combobox.Popup className="shadcn-combobox-popup">
            <Combobox.Empty className="shadcn-combobox-empty">{props.emptyLabel}</Combobox.Empty>
            <Combobox.List className="shadcn-combobox-list">
              {(item: Value) => (
                <Combobox.Item key={props.itemId(item)} className="shadcn-combobox-item" value={item}>
                  <span className="shadcn-combobox-indicator">
                    <Combobox.ItemIndicator><Check aria-hidden="true" size={13} /></Combobox.ItemIndicator>
                  </span>
                  <span className="shadcn-combobox-item-copy">
                    <strong>{props.itemLabel(item)}</strong>
                    <small>{props.description(item)}</small>
                  </span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </>
  );
}

export function ShadcnSingleCombobox<Value>(props: CommonComboboxProps<Value> & Readonly<{
  onValueChange: (value: Value | null) => void;
  value: Value | null;
}>) {
  return (
    <Combobox.Root
      autoHighlight
      itemToStringLabel={props.itemLabel}
      itemToStringValue={props.itemId}
      items={props.items}
      disabled={props.disabled}
      value={props.value}
      onValueChange={props.onValueChange}
    >
      <ComboboxParts {...props} />
    </Combobox.Root>
  );
}
