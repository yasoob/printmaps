import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CircleHelp } from 'lucide-react';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import './featureHelp.css';

export function FeatureHelp({ label, children, className = '' }: Readonly<{
  label: string;
  children: ReactNode;
  className?: string;
}>) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [boundary, setBoundary] = useState<HTMLElement | undefined>();
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
  const attach = useCallback((node: HTMLSpanElement | null) => {
    if (!node) return;
    // Stay in the modal's focus scope, but outside its scrolling body.
    const dialog = node.closest<HTMLElement>('[data-slot="dialog-content"]');
    setContainer(dialog ?? node);
    setBoundary(dialog ?? undefined);
  }, []);

  return <span ref={attach} className={`feature-help ${className}`}>
    <Tooltip
      open={open}
      onOpenChange={(nextOpen, details) => {
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
          setPinned((value) => !value);
          setPreviewOpen(false);
        }}
      >
        <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent
        container={container}
        positionerClassName="feature-help-positioner"
        side="bottom"
        align="start"
        sideOffset={6}
        positionMethod="fixed"
        collisionBoundary={boundary}
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
}
