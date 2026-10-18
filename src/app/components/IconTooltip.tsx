import { memo, type ComponentProps, type ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type IconTooltipProps = Readonly<{
  // Visible tooltip text; keep it equal to (or a shorter form of) the control's accessible name.
  label: string;
  // Optional keyboard shortcut hint, e.g. "R" or "⌘Z".
  shortcut?: string;
  side?: ComponentProps<typeof TooltipContent>['side'];
  // The trigger element (usually an icon-only Button); its props, ref and aria-label are kept.
  children: ReactElement;
}>;

/**
Shared hover/focus tooltip for icon-only controls. Replaces native `title=` so hints look the same
on every OS and include the keyboard shortcut. Open state is local to each tooltip.
*/
// Memoized so a trigger update (e.g. Undo becoming enabled) does not re-render the closed popup.
const IconTooltipContent = memo(function IconTooltipContent({ label, shortcut, side }: Omit<IconTooltipProps, 'children'>) {
  return (
    <TooltipContent side={side} showArrow={false}>
      <span>{label}</span>
      {shortcut && <kbd className="studio-tooltip-shortcut">{shortcut}</kbd>}
    </TooltipContent>
  );
});

export function IconTooltip({ label, shortcut, side = 'bottom', children }: IconTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <IconTooltipContent label={label} shortcut={shortcut} side={side} />
    </Tooltip>
  );
}
