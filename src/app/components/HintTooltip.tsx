import type { ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

/**
 * Visual hint for an icon-only control, replacing the native `title` tooltip. The child keeps its
 * own accessible name; the hint is supplementary, so it is not announced as a description.
 */
export function HintTooltip({ label, children, side = 'bottom' }: Readonly<{
  label: string;
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}>) {
  return (
    <Tooltip>
      <TooltipTrigger delay={500} closeOnClick render={children} />
      <TooltipContent side={side} showArrow={false} aria-hidden="true">{label}</TooltipContent>
    </Tooltip>
  );
}
