import { ChevronDown, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';
import { IconTooltip } from './IconTooltip';

export function ToolCardHeader({ closeLabel, collapse, icon: Icon, onClose, title }: Readonly<{
  closeLabel: string;
  collapse?: { label: string; onCollapse: () => void };
  icon: LucideIcon;
  onClose: () => void;
  title: string;
}>) {
  return (
    <div className="tool-card-heading">
      <strong><Icon aria-hidden="true" size={16} strokeWidth={1.8} />{title}</strong>
      <div className="tool-card-heading-actions">
        {collapse && <IconTooltip label={collapse.label}><Button variant="ghost" size="icon-sm" aria-label={collapse.label} onClick={collapse.onCollapse}><ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} /></Button></IconTooltip>}
        <IconTooltip label={closeLabel}><Button variant="ghost" size="icon-sm" aria-label={closeLabel} onClick={onClose}><X aria-hidden="true" size={16} strokeWidth={1.75} /></Button></IconTooltip>
      </div>
    </div>
  );
}

export function ToolCardActions({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="tool-card-actions">{children}</div>;
}
