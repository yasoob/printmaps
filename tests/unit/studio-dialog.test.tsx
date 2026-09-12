import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  StudioDialogActions,
  StudioDialogBody,
  StudioDialogButton,
  StudioDialogHeader,
  StudioDialogSection,
} from '../../src/components/ui/studio-dialog';

it('preserves button refs, keyboard activation and non-submitting defaults', async () => {
  const onClick = vi.fn();
  const onSubmit = vi.fn((event) => event.preventDefault());
  const ref = createRef<HTMLButtonElement>();
  const user = userEvent.setup();
  render(<form onSubmit={onSubmit}><StudioDialogButton ref={ref} onClick={onClick}>Keep editing</StudioDialogButton></form>);
  const button = screen.getByRole('button', { name: 'Keep editing' });
  expect(ref.current).toBe(button);
  expect(button).toHaveAttribute('data-dialog-variant', 'ghost');
  await user.tab();
  expect(button).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(onClick).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
});

it('keeps primary and secondary actions disabled while their workflow is unavailable', async () => {
  const onClick = vi.fn();
  const user = userEvent.setup();
  render(
    <StudioDialogActions stackOnMobile>
      <StudioDialogButton variant="secondary" disabled onClick={onClick}>Download copy</StudioDialogButton>
      <StudioDialogButton variant="primary" disabled onClick={onClick}>Replace project</StudioDialogButton>
    </StudioDialogActions>,
  );
  const primary = screen.getByRole('button', { name: 'Replace project' });
  expect(primary).toHaveClass('primary-button');
  expect(primary.closest('footer')).toHaveAttribute('data-stack-on-mobile', 'true');
  for (const button of screen.getAllByRole('button')) {
    expect(button).toBeDisabled();
    await user.click(button);
  }
  expect(onClick).not.toHaveBeenCalled();
});

it('preserves heading, region and scroll-focus semantics without adding tab stops', () => {
  render(
    <>
      <StudioDialogHeader><h2>Export map</h2></StudioDialogHeader>
      <StudioDialogBody role="region" aria-label="Export settings" tabIndex={0}>
        <StudioDialogSection aria-labelledby="output-title">
          <h3 id="output-title">Output</h3>
          <p>A4 landscape</p>
        </StudioDialogSection>
      </StudioDialogBody>
    </>,
  );
  expect(screen.getByRole('heading', { name: 'Export map', level: 2 })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Export settings' })).toHaveAttribute('tabindex', '0');
  expect(screen.getByRole('region', { name: 'Output' })).not.toHaveAttribute('tabindex');
});
