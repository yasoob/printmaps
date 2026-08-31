import { Ellipsis } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type LayerMenuProps = {
  onDelete: () => void;
  onDuplicate: () => void;
  onReplace: (trigger: HTMLElement | null) => void;
  replaceDisabled: boolean;
};

export function LayerMenu({ onReplace, onDuplicate, onDelete, replaceDisabled }: LayerMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) queueMicrotask(() => buttonRef.current?.focus());
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')?.focus();
      }}
    >
      <DropdownMenuTrigger
        render={(
          <button
            ref={buttonRef}
            className="icon-button"
            type="button"
            aria-label="Layer menu"
            onMouseDown={() => { if (!open) setOpen(true); }}
          >
            <Ellipsis aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
        )}
      />
      <DropdownMenuContent ref={menuRef} className="layer-menu" align="end">
        <DropdownMenuItem disabled={replaceDisabled} onClick={() => onReplace(buttonRef.current)}>
          Replace layer data
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>Duplicate layer</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>Delete layer</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
