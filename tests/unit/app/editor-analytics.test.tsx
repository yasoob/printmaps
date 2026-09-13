import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { flushEditorAnalytics } from '../../../src/analytics/editorAnalytics';

afterEach(() => {
  cleanup();
  flushEditorAnalytics();
  vi.unstubAllGlobals();
});

it('tracks button and keyboard edits through the same action without exposing input text', async () => {
  const gtag = vi.fn();
  vi.stubGlobal('gtag', gtag);
  const user = userEvent.setup();
  render(<App autosaveRepository={null} />);
  expect(gtag).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Select City center' }));
  const name = screen.getByRole('textbox', { name: 'Layer name' });
  await user.clear(name);
  await user.type(name, 'Private home');
  await user.tab();
  flushEditorAnalytics();
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');

  const recorded = gtag.mock.calls.map((call) => call[2].action);
  expect(recorded.filter((action) => action === 'renameLayer')).toHaveLength(1);
  expect(recorded.filter((action) => action === 'undo')).toHaveLength(1);
  expect(recorded.filter((action) => action === 'redo')).toHaveLength(1);
  expect(JSON.stringify(gtag.mock.calls)).not.toMatch(/Private home|City center/);
  expect(screen.getByRole('button', { name: 'Select Private home' })).toBeInTheDocument();
});
