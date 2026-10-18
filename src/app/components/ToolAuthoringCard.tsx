import { ChevronDown, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { memo, type ReactNode } from 'react';
import { IconTooltip } from './IconTooltip';

// Flat, memoized props: panel field edits do not re-render the header's tooltip buttons.
export const ToolCardHeader = memo(function ToolCardHeader({ closeLabel, collapseLabel, onCollapse, icon: Icon, onClose, title }: Readonly<{
  closeLabel: string;
  collapseLabel?: string;
  onCollapse?: () => void;
  icon: LucideIcon;
  onClose: () => void;
  title: string;
}>) {
  return (
    <div className="tool-card-heading">
      <strong><Icon aria-hidden="true" size={16} strokeWidth={1.8} />{title}</strong>
      <div className="tool-card-heading-actions">
        {collapseLabel && onCollapse && <IconTooltip label={collapseLabel}><Button variant="ghost" size="icon-sm" aria-label={collapseLabel} onClick={onCollapse}><ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} /></Button></IconTooltip>}
        <IconTooltip label={closeLabel}><Button variant="ghost" size="icon-sm" aria-label={closeLabel} onClick={onClose}><X aria-hidden="true" size={16} strokeWidth={1.75} /></Button></IconTooltip>
      </div>
    </div>
  );
});

export function ToolCardActions({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="tool-card-actions">{children}</div>;
}
