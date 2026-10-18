import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CircleHelp } from 'lucide-react';
import { memo, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import './featureHelp.css';

// Memoized: callers pass string or hoisted content, so an owner's unrelated update
// does not re-render the closed tooltip portal.
export const FeatureHelp = memo(function FeatureHelp({ label, children, className = '' }: Readonly<{
  label: string;
  children: ReactNode;
  className?: string;
}>) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [host, setHost] = useState<{ container: HTMLElement | null; boundary?: HTMLElement }>({ container: null });
  const rootRef = useRef<HTMLSpanElement>(null);
  const popupId = useId();
  const open = previewOpen || pinned;
  useEffect(() => {
    if (!open) return;
    // Hover does not move focus into the tooltip; dismiss it before the modal.
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setPreviewOpen(false);
      setPinned(false);
    };
    window.addEventListener('keydown', dismiss, {capture: true});
    return () => window.removeEventListener('keydown', dismiss, true);
  }, [open]);
  // Resolved when opening (batched with the open state) instead of after mount, so
  // mounting a help button costs one render and closed helps never re-render.
  const resolveHost = useCallback(() => {
    const node = rootRef.current;
    if (!node) return;
    // Stay in the modal's focus scope, but outside its scrolling body.
    const dialog = node.closest<HTMLElement>('[data-slot="dialog-content"]');
    const container = dialog ?? node;
    setHost((current) => current.container === container ? current : { container, boundary: dialog ?? undefined });
  }, []);

  return <span ref={rootRef} className={`feature-help ${className}`}>
    <Tooltip
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (nextOpen) resolveHost();
        setPreviewOpen(nextOpen);
        if (details.reason === 'escape-key' || details.reason === 'outside-press' || (!nextOpen && details.reason === 'trigger-focus')) {
          setPinned(false);
        }
      }}
    >
      <TooltipTrigger
        type="button"
        className="icon-button feature-help-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? popupId : undefined}
        delay={200}
        closeDelay={150}
        closeOnClick={false}
        onClick={() => {
          resolveHost();
          setPinned((value) => !value);
          setPreviewOpen(false);
        }}
      >
        <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent
        container={host.container}
        positionerClassName="feature-help-positioner"
        side="bottom"
        align="start"
        sideOffset={6}
        positionMethod="fixed"
        collisionBoundary={host.boundary}
        collisionPadding={12}
        showArrow={false}
        id={popupId}
        role="tooltip"
        className="feature-help-popup block w-auto max-w-none animate-none"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  </span>;
});
