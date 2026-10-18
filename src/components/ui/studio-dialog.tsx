import { XIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button, type ButtonSize } from './button';
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from './dialog';
import { cn } from '@/lib/utils';
import './studio-dialog.css';

export type StudioDialogSize = 'sm' | 'md' | 'lg';

/**
 * Standard editor dialog surface: one of three widths, consistent padding, no floating close button
 * (StudioDialogHeader renders an aligned one). Compose Header → Body → (Feedback) → Actions.
 */
export function StudioDialog({
  size = 'md', className, ...props
}: Omit<ComponentProps<typeof DialogContent>, 'showCloseButton'> & { size?: StudioDialogSize }) {
  return <DialogContent {...props} showCloseButton={false} data-size={size} className={cn('studio-dialog', className)} />;
}

type StudioDialogHeaderProps = Omit<ComponentProps<'header'>, 'title'> & {
  /**
  Renders the standard title row. Without it the header is a plain wrapper for custom content.
  */
  title?: ReactNode;
  description?: ReactNode;
  /**
  FeatureHelp (or similar) rendered beside the title.
  */
  help?: ReactNode;
  showClose?: boolean;
  closeLabel?: string;
};

export function StudioDialogHeader({
  className, title, description, help, showClose = true, closeLabel = 'Close', children, ...props
}: StudioDialogHeaderProps) {
  if (title === undefined) return <header className={cn('studio-dialog-header', className)} {...props}>{children}</header>;
  return (
    <header className={cn('studio-dialog-header', className)} data-standard="true" {...props}>
      <div className="studio-dialog-heading">
        <div className="studio-dialog-title-row">
          <DialogTitle className="studio-dialog-title">{title}</DialogTitle>
          {help}
        </div>
        {description && <DialogDescription className="studio-dialog-description">{description}</DialogDescription>}
        {children}
      </div>
      {showClose && (
        <DialogClose render={<Button variant="ghost" size="icon" className="studio-dialog-close close-button" aria-label={closeLabel} />}>
          <XIcon aria-hidden="true" size={16} strokeWidth={1.75} />
        </DialogClose>
      )}
    </header>
  );
}

export function StudioDialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('studio-dialog-body', className)} {...props} />;
}

export function StudioDialogFeedback({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('studio-dialog-feedback', className)} {...props} />;
}

export function StudioDialogSection({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('studio-dialog-section', className)} {...props} />;
}

export function StudioDialogActions({
  className, stackOnMobile = false, start, children, ...props
}: ComponentProps<'footer'> & { stackOnMobile?: boolean; /** Left-aligned content such as a secondary link or status. */ start?: ReactNode }) {
  return (
    <footer className={cn('studio-dialog-actions', className)} data-stack-on-mobile={stackOnMobile} {...props}>
      {start !== undefined && <div className="studio-dialog-actions-start">{start}</div>}
      {children}
    </footer>
  );
}

export type StudioDialogButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export function StudioDialogButton({
  className, variant = 'ghost', size = 'default', ...props
}: Omit<ComponentProps<typeof Button>, 'variant' | 'size'> & { variant?: StudioDialogButtonVariant; size?: Extract<ButtonSize, 'sm' | 'default'> }) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn('studio-dialog-button', variant === 'primary' && 'primary-button', className)}
      data-dialog-variant={variant}
      {...props}
    />
  );
}
