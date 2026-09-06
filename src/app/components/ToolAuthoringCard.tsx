import { ChevronDown, X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function ToolCardHeader({ closeLabel, collapse, icon: Icon, onClose, title }: Readonly<{
  closeLabel: string;
  collapse?: { label: string; onCollapse: () => void };
  icon: LucideIcon;
  onClose: () => void;
  title: string;
}>) {
  return (
    <div className="tool-card-heading">
      <strong><Icon aria-hidden="true" size={17} />{title}</strong>
      <div className="tool-card-heading-actions">
        {collapse && <button className="close-button" type="button" aria-label={collapse.label} title={collapse.label} onClick={collapse.onCollapse}><ChevronDown aria-hidden="true" size={15} /></button>}
        <button className="close-button" type="button" aria-label={closeLabel} onClick={onClose}><X aria-hidden="true" size={15} /></button>
      </div>
    </div>
  );
}

export function ToolCardActions({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="tool-card-actions">{children}</div>;
}
