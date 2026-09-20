import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeatureHelp } from '../../src/app/components/FeatureHelp';
import { ExportBasemapMode } from '../../src/app/components/ExportBasemapMode';
import { Dialog, DialogContent, DialogTitle } from '../../src/components/ui/dialog';

function ModalHarness() {
  const [open, setOpen] = useState(true);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent>
      <DialogTitle>Export</DialogTitle>
      <div data-testid="scroll-body"><FeatureHelp label="Export help">No hidden errors.</FeatureHelp></div>
      <button>Download</button>
    </DialogContent>
  </Dialog>;
}

it('opens on keyboard focus, describes its trigger, and dismisses without submitting or rerendering its owner', async () => {
  const user = userEvent.setup();
  const rendered = vi.fn();
  const submitted = vi.fn((event) => event.preventDefault());
  function Owner() {
    rendered();
    return <form onSubmit={submitted}>
      <FeatureHelp label="Format help">An explanation on demand.</FeatureHelp>
      <button type="button">Next setting</button>
    </form>;
  }
  render(<Owner />);
  const renders = rendered.mock.calls.length;
  const help = screen.getByRole('button', { name: 'Format help' });
  expect(help).not.toHaveAttribute('title');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  await user.tab();
  expect(help).toHaveFocus();
  expect(await screen.findByRole('tooltip')).toHaveTextContent('An explanation on demand.');
  expect(help).toHaveAccessibleDescription('An explanation on demand.');
  await user.keyboard('{Enter}');
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  expect(help).toHaveFocus();
  expect(help).toHaveAttribute('aria-expanded', 'false');
  expect(submitted).not.toHaveBeenCalled();
  expect(rendered).toHaveBeenCalledTimes(renders);
});

it('keeps a click-pinned explanation open after pointer departure and closes on another click or outside press', async () => {
  const user = userEvent.setup();
  render(<><FeatureHelp label="Format help">Details</FeatureHelp><button>Outside help</button></>);
  const help = screen.getByRole('button', { name: 'Format help' });
  await user.click(help);
  await user.unhover(help);
  expect(screen.getByRole('tooltip')).toBeVisible();
  await user.click(help);
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  await user.click(help);
  await user.click(screen.getByRole('button', { name: 'Outside help' }));
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
});

it('portals inside the modal but outside its scroll body and consumes Escape before the parent dialog', async () => {
  const user = userEvent.setup();
  render(<ModalHarness />);
  const help = screen.getByRole('button', { name: 'Export help' });
  await user.click(help);
  const tooltip = screen.getByRole('tooltip');
  expect(screen.getByRole('dialog')).toContainElement(tooltip);
  expect(screen.getByTestId('scroll-body')).not.toContainElement(tooltip);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(help).toHaveFocus();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('keeps the reflowed-vector choice explicit while disclosing static caveats without changing the selection', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<ExportBasemapMode format="svg" mode="vector" available busy={false} onChange={onChange} />);
  expect(screen.getByRole('combobox', { name: 'Basemap rendering' })).toHaveValue('vector');
  expect(screen.getByRole('option', { name: 'True vector artwork (reflowed labels)' })).toBeInTheDocument();
  expect(screen.queryByText(/unsupported glyphs/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Basemap rendering help' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent('unsupported glyphs block vector export');
  expect(onChange).not.toHaveBeenCalled();
});
