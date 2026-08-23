import { useRef, useState } from 'react';

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
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      items[(currentIndex + direction + items.length) % items.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      queueMicrotask(() => buttonRef.current?.focus());
    }
  };
  const toggleMenu = () => {
    setOpen(!open);
    if (!open) queueMicrotask(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus());
  };

  return (
    <>
      <button ref={buttonRef} className="icon-button" type="button" aria-label="Layer menu" aria-haspopup="menu" aria-expanded={open} onClick={toggleMenu}>•••</button>
      {open && (
        <div ref={menuRef} className="layer-menu" role="menu" onKeyDown={handleKeyDown}>
          <button type="button" role="menuitem" disabled={replaceDisabled} onClick={() => { setOpen(false); onReplace(buttonRef.current); }}>Replace layer data</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDuplicate(); }}>Duplicate layer</button>
          <button className="danger-button" type="button" role="menuitem" onClick={onDelete}>Delete layer</button>
        </div>
      )}
    </>
  );
}
