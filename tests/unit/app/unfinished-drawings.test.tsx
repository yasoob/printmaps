import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createProjectStore } from '../../../src/app/store';
import { createInitialProjectDocument } from '../../../src/domain/project';
import type { AutosaveRepository } from '../../../src/storage/autosave';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

function isUnloadPrevented() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

function repository(save = vi.fn().mockResolvedValue(undefined)): AutosaveRepository {
  return { load: vi.fn().mockResolvedValue(null), save, discard: vi.fn(), close: vi.fn() };
}

const notice = () => screen.queryByRole('status', { name: 'Unfinished drawing' });
const status = () => screen.getByRole('status', { name: 'Autosave status' });

async function drawArea(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Area (S)' }));
  await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
}

describe('unfinished drawing persistence contract', () => {
  it('stores only a transient, epoch-guarded presence bit without document or history changes', () => {
    const store = createProjectStore();
    const before = store.getState();
    before.setHasUnfinishedDrawing(0, true);
    expect(store.getState().hasUnfinishedDrawing).toBe(true);
    expect(store.getState().document).toBe(before.document);
    expect(store.getState().past).toBe(before.past);
    store.getState().openDocument(createInitialProjectDocument());
    expect(store.getState().hasUnfinishedDrawing).toBe(false);
    store.getState().setHasUnfinishedDrawing(0, true);
    expect(store.getState().hasUnfinishedDrawing).toBe(false);
    store.getState().setHasUnfinishedDrawing(1, true);
    store.getState().setHasUnfinishedDrawing(0, false);
    expect(store.getState().hasUnfinishedDrawing).toBe(true);
  });

  it('does not warn for empty tools or unmodified route extension anchors', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={repository()} />);
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    expect(notice()).toBeNull();
    expect(isUnloadPrevented()).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Select (V)' }));
    await drawArea(user);
    expect(notice()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Close Area menu' }));
    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    await user.click(screen.getByRole('button', { name: 'Extend end' }));
    await screen.findByText('Draft points (4)');
    expect(notice()).toBeNull();
    expect(isUnloadPrevented()).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Map route point 3' }));
    expect(isUnloadPrevented()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Undo last route point' }));
    expect(isUnloadPrevented()).toBe(false);
    expect(notice()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Preview drag route point 1' }));
    expect(screen.getByRole('button', { name: 'Undo last route point' })).toBeDisabled();
    expect(isUnloadPrevented()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Cancel route' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(isUnloadPrevented()).toBe(false);
  });

  it('protects raw route input immediately, retains invalid text, and clears corrected or discarded input', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByText('Add by coordinates or existing place'));
    const longitude = screen.getByRole('textbox', { name: 'New route point longitude' });
    const original = (longitude as HTMLInputElement).value;
    await user.clear(longitude);
    await user.type(longitude, '181');
    expect(isUnloadPrevented()).toBe(true);
    await user.tab();
    expect(longitude).toHaveValue('181');
    expect(screen.getByRole('button', { name: 'Add coordinates' })).toBeDisabled();
    expect(status()).toHaveTextContent('Local saving unavailable · Unfinished work not saved');
    await user.clear(longitude);
    await user.type(longitude, original);
    expect(isUnloadPrevented()).toBe(false);
    await user.clear(longitude);
    await user.type(longitude, '16.39');
    await user.click(screen.getByRole('button', { name: 'Cancel route' }));
    expect(screen.getByRole('dialog', { name: 'Discard route changes?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(longitude).toHaveValue('16.39');
    await user.click(screen.getByRole('button', { name: 'Select (V)' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(isUnloadPrevented()).toBe(false);
    expect(notice()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByText('Add by coordinates or existing place'));
    expect(screen.getByRole('textbox', { name: 'New route point longitude' })).toHaveValue(original);
  });

  it('acknowledges added coordinates so Undo to an empty route has no phantom input warning', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByText('Add by coordinates or existing place'));
    const longitude = screen.getByRole('textbox', { name: 'New route point longitude' });
    await user.clear(longitude);
    await user.type(longitude, '16.4');
    await user.click(screen.getByRole('button', { name: 'Add coordinates' }));
    expect(isUnloadPrevented()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Undo last route point' }));
    expect(isUnloadPrevented()).toBe(false);
    expect(notice()).toBeNull();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Existing place for route point' }), 'poi-cafe');
    expect(isUnloadPrevented()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Add place' }));
    await user.click(screen.getByRole('button', { name: 'Undo last route point' }));
    expect(isUnloadPrevented()).toBe(false);
  });

  it('retains area input and its warning across sources, other tools, and close, until explicit Draw Cancel', async () => {
    const user = userEvent.setup();
    render(<App autosaveRepository={null} />);
    await drawArea(user);
    const longitude = screen.getByRole('textbox', { name: 'New area point longitude' });
    await user.clear(longitude);
    await user.type(longitude, '-');
    await user.click(screen.getByRole('button', { name: 'Add area point' }));
    expect(longitude).toHaveValue('-');
    expect(isUnloadPrevented()).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'Travel time' }));
    await user.click(screen.getByRole('button', { name: 'Close Area menu' }));
    expect(isUnloadPrevented()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Cancel route' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(isUnloadPrevented()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Area (S)' }));
    await user.click(screen.getByRole('tab', { name: 'Draw custom area' }));
    expect(screen.getByRole('textbox', { name: 'New area point longitude' })).toHaveValue('-');
    await user.click(screen.getByRole('button', { name: 'Cancel area' }));
    expect(notice()).toBeNull();
    expect(isUnloadPrevented()).toBe(false);
  });

});

describe('completed layers and draft navigation', () => {
  it('keeps saving, saved, and failed completed-document status truthful without saving transient work', async () => {
    const user = userEvent.setup();
    let finishSave!: () => void;
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishSave = resolve; }))
      .mockRejectedValueOnce(new Error('Storage unavailable'));
    render(<App autosaveRepository={repository(save)} />);
    await user.click(screen.getByRole('button', { name: 'Portrait' }));
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    expect(status()).toHaveTextContent('Saving local draft… · Unfinished work not saved');
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await act(async () => finishSave());
    expect(status()).toHaveTextContent('Completed layers saved locally · Unfinished work not saved');
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 350)); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].layers).toHaveLength(4);
    expect(save.mock.calls[0][0]).not.toHaveProperty('hasUnfinishedDrawing');
    await user.click(screen.getByRole('button', { name: 'Landscape' }));
    await waitFor(() => expect(status()).toHaveTextContent('Autosave paused · Unfinished work not saved'));
    expect(screen.getByRole('alert', { name: 'Autosave status' })).toHaveTextContent('Save a project file');
    expect(isUnloadPrevented()).toBe(true);
  });

  it.each(['route', 'area'] as const)('clears the %s warning on Finish and preserves single-action document Undo', async (tool) => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<App autosaveRepository={repository(save)} />);
    if (tool === 'area') await drawArea(user);
    else await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    if (tool === 'area') await user.click(screen.getByRole('button', { name: 'Map shape point 3' }));
    expect(isUnloadPrevented()).toBe(true);
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: `Finish ${tool}` }));
    expect(notice()).toBeNull();
    expect(isUnloadPrevented()).toBe(false);
    await waitFor(() => expect(status()).toHaveTextContent('All changes saved locally'));
    expect(save.mock.calls[0][0].layers).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(notice()).toBeNull();
  });

  it('requires a deliberate project-opening choice and never revives old epoch drafts', async () => {
    const user = userEvent.setup();
    const { container } = render(<App autosaveRepository={null} />);
    await drawArea(user);
    await user.click(screen.getByRole('button', { name: 'Map route point 1' }));
    await user.click(screen.getByRole('button', { name: 'Route (R)' }));
    await user.click(screen.getByRole('button', { name: 'Map route point 2' }));
    const opened = createInitialProjectDocument();
    opened.title = 'Replacement';
    const input = container.querySelector<HTMLInputElement>('input[accept^=".printmap.json"]')!;
    const choose = () => fireEvent.change(input, {
      target: { files: [new File([JSON.stringify(opened)], 'replacement.printmap.json', { type: 'application/json' })] },
    });
    choose();
    await screen.findByRole('dialog', { name: 'Discard unfinished work?' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus());
    await user.keyboard('p{Backspace}');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-interaction-mode', 'route');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('2 points');
    expect(isUnloadPrevented()).toBe(true);
    choose();
    await user.click(await screen.findByRole('button', { name: 'Discard unfinished work and open' }));
    expect(await screen.findByRole('button', { name: 'Replacement' })).toBeInTheDocument();
    expect(isUnloadPrevented()).toBe(false);
    for (const tool of ['Place (P)', 'Area (S)', 'Route (R)']) {
      await user.click(screen.getByRole('button', { name: tool }));
      expect(notice()).toBeNull();
      expect(isUnloadPrevented()).toBe(false);
    }
    expect(screen.getByRole('status', { name: 'Route drawing status' })).toHaveTextContent('Click the map');
  });
});
