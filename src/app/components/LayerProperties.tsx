import { useRef, useState } from 'react';
import type { ContentLayer } from '../../domain/project';
import { NumberField, PropertyRow, PropertySection } from './PropertyControls';

type LayerPropertiesProps = {
  layer: ContentLayer;
  onRename: (name: string) => void;
  onOpacityChange: (opacity: number) => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function LayerMenu({ onDuplicate, onDelete }: Pick<LayerPropertiesProps, 'onDuplicate' | 'onDelete'>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
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
    if (!open) queueMicrotask(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
  };

  return (
    <>
      <button ref={buttonRef} className="icon-button" type="button" aria-label="Layer menu" aria-haspopup="menu" aria-expanded={open} onClick={toggleMenu}>•••</button>
      {open && (
        <div ref={menuRef} className="layer-menu" role="menu" onKeyDown={handleKeyDown}>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDuplicate(); }}>Duplicate layer</button>
          <button className="danger-button" type="button" role="menuitem" onClick={onDelete}>Delete layer</button>
        </div>
      )}
    </>
  );
}

export function LayerProperties({
  layer,
  onRename,
  onOpacityChange,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onDelete,
}: LayerPropertiesProps) {
  const [nameEdit, setNameEdit] = useState(() => ({ source: layer.name, value: layer.name }));
  const [opacityEdit, setOpacityEdit] = useState(() => ({ source: layer.opacity, value: String(layer.opacity) }));
  const nameDraft = nameEdit.source === layer.name ? nameEdit.value : layer.name;
  const opacityDraft = opacityEdit.source === layer.opacity ? opacityEdit.value : String(layer.opacity);
  const commitName = () => {
    const name = nameDraft.trim();
    if (!name) {
      setNameEdit({ source: layer.name, value: layer.name });
      return;
    }
    setNameEdit({ source: name, value: name });
    onRename(name);
  };
  const commitOpacity = () => {
    const opacity = Number(opacityDraft);
    if (opacityDraft.trim() === '' || !Number.isFinite(opacity)) {
      setOpacityEdit({ source: layer.opacity, value: String(layer.opacity) });
      return;
    }
    const clampedOpacity = Math.max(0, Math.min(100, opacity));
    setOpacityEdit({ source: clampedOpacity, value: String(clampedOpacity) });
    onOpacityChange(clampedOpacity);
  };

  return (
    <div className="properties-panel">
      <div className="properties-title">
        <div><span className="eyebrow">Layer properties</span><h2>{layer.name}</h2></div>
        <LayerMenu onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
      <PropertySection title="Layer">
        <PropertyRow label="Name"><input aria-label="Layer name" value={nameDraft} onChange={(event) => setNameEdit({ source: layer.name, value: event.target.value })} onBlur={commitName} /></PropertyRow>
        <PropertyRow label="Opacity"><label className="number-field"><input aria-label="Layer opacity" value={opacityDraft} onChange={(event) => setOpacityEdit({ source: layer.opacity, value: event.target.value })} onBlur={commitOpacity} /><small>%</small></label></PropertyRow>
        <PropertyRow label="Visible"><button aria-label="Toggle layer visibility" className={`toggle${layer.visible ? ' is-on' : ''}`} type="button" aria-pressed={layer.visible} onClick={onToggleVisibility}><span /></button></PropertyRow>
        <PropertyRow label="Locked"><button aria-label="Toggle layer lock" className={`toggle${layer.locked ? ' is-on' : ''}`} type="button" aria-pressed={layer.locked} onClick={onToggleLock}><span /></button></PropertyRow>
      </PropertySection>
      <PropertySection title="Appearance">
        <PropertyRow label="Stroke"><label className="color-field"><span style={{ background: 'var(--studio-route)' }} /><input aria-label="Layer stroke color" value="Route red" readOnly /></label></PropertyRow>
        <PropertyRow label="Width"><NumberField value="3" suffix="px" ariaLabel="Layer stroke width" /></PropertyRow>
        <PropertyRow label="Blend"><select aria-label="Layer blend mode" defaultValue="Normal"><option>Normal</option><option>Multiply</option><option>Screen</option></select></PropertyRow>
      </PropertySection>
    </div>
  );
}
