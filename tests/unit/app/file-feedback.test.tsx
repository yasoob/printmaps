import { createRef } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { FileFeedback, FileFeedbackGroup } from '../../../src/app/components/FileFeedback';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('keeps errors before earlier and later successes in one notification region', async () => {
  const user = userEvent.setup();
  const trigger = createRef<HTMLButtonElement>();
  const dismiss = vi.fn();
  const notices = (message: string) => <>
    <button ref={trigger}>Return to Project</button>
    <FileFeedbackGroup>
      <FileFeedback kind="success" label="Import status" message={message} onDismiss={vi.fn()} returnFocusRef={trigger} />
      <FileFeedback kind="error" label="Open status" message="Invalid project file" onDismiss={dismiss} returnFocusRef={trigger} />
    </FileFeedbackGroup>
  </>;
  const view = render(notices('Earlier import succeeded'));
  const region = screen.getByRole('region', { name: 'File notifications' });
  const error = within(region).getByRole('alert', { name: 'Open status' });
  const success = within(region).getByRole('status', { name: 'Import status' });
  expect(error.compareDocumentPosition(success) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  view.rerender(notices('Later import succeeded'));
  expect(within(region).getByRole('alert', { name: 'Open status' })).toHaveTextContent('Invalid project file');
  expect(error.compareDocumentPosition(success) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  within(error).getByRole('button', { name: 'Dismiss open status' }).focus();
  await user.keyboard('{Enter}');
  expect(dismiss).toHaveBeenCalledOnce();
  expect(trigger.current).toHaveFocus();
});

it('shows a project error above imported-data success and dismisses only the requested notice', async () => {
  const user = userEvent.setup();
  const { container } = render(<App autosaveRepository={null} />);
  const input = container.querySelector<HTMLInputElement>('input[accept^=".geojson"]');
  const open = container.querySelector<HTMLInputElement>('input[accept^=".printmap.json"]');
  if (!input || !open) throw new Error('Expected both file workflows');
  fireEvent.change(input, { target: { files: [new File([
    JSON.stringify({ type: 'Feature', properties: { name: 'Imported point' }, geometry: { type: 'Point', coordinates: [16.4, 48.2] } }),
  ], 'point.geojson')] } });
  await user.click(await screen.findByRole('button', { name: 'Import 1 file' }));
  await screen.findByRole('status', { name: 'Map data import status' });
  fireEvent.change(open, { target: { files: [new File(['{'], 'invalid.printmap.json')] } });
  const error = await screen.findByRole('alert', { name: 'Project file status' });
  const region = screen.getByRole('region', { name: 'File notifications' });
  expect(region).toContainElement(error);
  expect(within(region).getByRole('status', { name: 'Map data import status' })).toHaveTextContent('Imported 1 GeoJSON layer');
  await user.click(within(error).getByRole('button', { name: 'Dismiss project file status' }));
  expect(screen.queryByRole('alert', { name: 'Project file status' })).toBeNull();
  expect(screen.getByRole('status', { name: 'Map data import status' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Project' })).toHaveFocus());
  await user.click(screen.getByRole('button', { name: 'Dismiss map data import status' }));
  expect(screen.queryByRole('status', { name: 'Map data import status' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Select Imported point' })).toBeInTheDocument();
});
