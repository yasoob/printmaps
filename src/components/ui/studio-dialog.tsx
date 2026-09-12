import type { ComponentProps } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import './studio-dialog.css';

export function StudioDialogHeader({ className, ...props }: ComponentProps<'header'>) {
  return <header className={cn('studio-dialog-header', className)} {...props} />;
}

export function StudioDialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('studio-dialog-body', className)} {...props} />;
}

export function StudioDialogSection({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('studio-dialog-section', className)} {...props} />;
}

export function StudioDialogActions({
  className, stackOnMobile = false, ...props
}: ComponentProps<'footer'> & { stackOnMobile?: boolean }) {
  return <footer className={cn('studio-dialog-actions', className)} data-stack-on-mobile={stackOnMobile} {...props} />;
}

export function StudioDialogButton({
  className, variant = 'ghost', ...props
}: Omit<ComponentProps<typeof Button>, 'variant'> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return (
    <Button
      type="button"
      variant={variant === 'primary' ? 'default' : variant}
      className={cn('studio-dialog-button', variant === 'primary' && 'primary-button', className)}
      data-dialog-variant={variant}
      {...props}
    />
  );
}
