import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDialog } from '../../../src/app/components/ExportDialog';
import { createInitialProjectDocument } from '../../../src/domain/project';

it('withdraws every download action during recovery and restores it only when an exporter is published', async () => {
  const document = createInitialProjectDocument();
  const exporter = vi.fn();
  const props = { document, filename: 'recovery', onClose: vi.fn() };
  const { rerender } = render(<ExportDialog {...props} exporter={exporter} />);
  const user = userEvent.setup();
  expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  rerender(<ExportDialog {...props} exporter={null} />);
  const dialog = screen.getByRole('dialog', { name: 'Export map' });
  for (const name of ['PNG', 'Layered SVG', 'Layered PSD', 'PDF']) {
    await user.click(within(dialog).getByRole('radio', { name: new RegExp(`^${name}`) }));
    expect(within(dialog).getByRole('button', { name: /^Download/ })).toBeDisabled();
  }
  expect(within(dialog).getByRole('status')).toHaveTextContent('retry the map');
  expect(exporter).not.toHaveBeenCalled();
  rerender(<ExportDialog {...props} exporter={exporter} />);
  expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  expect(within(dialog).getByRole('status')).toBeEmptyDOMElement();
});
