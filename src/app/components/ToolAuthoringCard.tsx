import { X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function ToolCardHeader({ closeLabel, icon: Icon, onClose, title }: Readonly<{
  closeLabel: string;
  icon: LucideIcon;
  onClose: () => void;
  title: string;
}>) {
  return (
    <div className="tool-card-heading">
      <strong><Icon aria-hidden="true" size={17} />{title}</strong>
      <button type="button" aria-label={closeLabel} onClick={onClose}><X aria-hidden="true" size={15} /></button>
    </div>
  );
}

export function ToolCardActions({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="tool-card-actions">{children}</div>;
}
