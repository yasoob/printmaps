import { createRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DragEndEvent, BeforeDragStartEvent, DragStartEvent, useDragDropMonitor } from '@dnd-kit/react';
import { LayersSidebar } from '../../../src/app/components/LayersSidebar';
import { ProjectStoreContext, useProject } from '../../../src/app/projectStoreContext';
import { createProjectStore } from '../../../src/app/store';
import type { MobilePanel } from '../../../src/app/hooks/useMobilePanels';
import { filteredLayerNavigationProject, layerNavigationProject } from '../../fixtures/layerNavigationProject';
import type { createLayerDropCompletion } from '../../../src/app/hooks/layerDropCompletion';

const dnd = vi.hoisted(() => ({
  handlers: {} as Parameters<typeof useDragDropMonitor>[0],
  manager: { dragOperation: { status: { idle: true, dropped: false } }, actions: { stop: vi.fn() }, plugins: [] },
  rowRenders: vi.fn(),
  completions: [] as Array<{
    options: Parameters<typeof createLayerDropCompletion>[0];
    invalidate: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));

// Controlled monitor events cover ownership edges; browser tests use the installed engine.
vi.mock('@dnd-kit/react', () => ({
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  DragDropProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  DragOverlay: () => null,
  useDragDropManager: () => dnd.manager,
  useDragDropMonitor: (handlers: typeof dnd.handlers) => { dnd.handlers = handlers; },
}));
vi.mock('@dnd-kit/react/sortable', () => ({
  isSortable: (source: object | null) => source !== null && 'initialIndex' in source,
  useSortable: () => ({ ref: vi.fn(), handleRef: vi.fn(), isDragging: false }),
}));
vi.mock('../../../src/app/hooks/layerDropCompletion', () => ({
  createLayerDropCompletion: (options: Parameters<typeof createLayerDropCompletion>[0]) => {
    const completion = { options, invalidate: vi.fn(), dispose: vi.fn() };
    dnd.completions.push(completion);
    return completion;
  },
}));
vi.mock('lucide-react', async (importOriginal) => ({
  ...await importOriginal<typeof import('lucide-react')>(),
  MapPin: () => { dnd.rowRenders(); return <span />; },
}));

function setup(project = filteredLayerNavigationProject()) {
  const store = createProjectStore(project);
  const props = {
    activePanel: null as MobilePanel | null, desktopCollapsed: false,
    closePanel: vi.fn(), openPanel: vi.fn(), onToggleCollapsed: vi.fn(),
    setPreviewedLayerId: vi.fn(), panelRef: createRef<HTMLElement>(), onKeyDown: vi.fn(),
    autosave: {
      status: 'Autosave ready', statusKind: 'status' as const, corrupted: false, decisionPending: false,
      discard: vi.fn(async () => true), recoveryData: undefined, continueWithoutAutosave: vi.fn(() => false),
      conflictOpen: false, conflictPending: false, conflictError: null, reviewConflict: vi.fn(),
      keepEditingConflict: vi.fn(), loadSavedVersion: vi.fn(async () => false),
    },
  };
  function Sidebar() {
    const layers = useProject((state) => state.document.layers);
    return <><LayersSidebar {...props} layers={layers} /><input aria-label="External property" /></>;
  }
  const ui = () => <ProjectStoreContext value={store}><Sidebar /></ProjectStoreContext>;
  const result = render(ui());
  return { store, props, ...result, refresh: () => result.rerender(ui()) };
}

function selection(id: string) { return document.querySelector<HTMLButtonElement>(`[data-layer-select="${CSS.escape(id)}"]`)!; }
function tabStops() {
  return [...document.querySelectorAll<HTMLButtonElement>('#layers-list button')].filter((button) => button.tabIndex >= 0 && !button.disabled);
}
function filter(value: string) { fireEvent.change(screen.getByRole('searchbox', { name: 'Filter layers by name' }), { target: { value } }); }
function startDrag(id = 'place-1', index = 0, activator = new Event('pointerdown'), previousGestureIndex = index) {
  const source = { id, initialIndex: previousGestureIndex, index };
  const operation = { source, activatorEvent: activator };
  const event = { operation, preventDefault: vi.fn() };
  act(() => dnd.handlers.onBeforeDragStart?.(event as unknown as BeforeDragStartEvent, dnd.manager as never));
  if (event.preventDefault.mock.calls.length === 0) act(() => {
    source.initialIndex = index;
    dnd.manager.dragOperation.status.idle = false;
    dnd.handlers.onDragStart?.({ operation } as unknown as DragStartEvent, dnd.manager as never);
  });
  return { event, finish: (to: number) => act(() => {
    source.index = to;
    dnd.manager.dragOperation.status.idle = true;
    dnd.manager.dragOperation.status.dropped = false;
    dnd.handlers.onDragEnd?.({ operation, canceled: false } as unknown as DragEndEvent, dnd.manager as never);
  }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  dnd.completions.length = 0;
  dnd.manager.dragOperation.status.idle = true;
  dnd.manager.actions.stop.mockImplementation(() => { dnd.manager.dragOperation.status.idle = true; });
});

describe('scalable layer navigation', () => {
  it('has four row Tab stops for 300 POIs, then exits, without changing document or selection', async () => {
    const { store } = setup(layerNavigationProject());
    const user = userEvent.setup();
    const before = store.getState().document;
    expect(tabStops()).toHaveLength(4);
    screen.getByRole('searchbox').focus();
    for (const name of ['Hide Place 001', 'Select Place 001', 'Lock Place 001', 'Reorder Place 001']) {
      await user.tab();
      expect(document.activeElement).toHaveAccessibleName(name);
    }
    await user.tab();
    expect(screen.getByLabelText('External property')).toHaveFocus();
    expect(store.getState().document).toBe(before);
    expect(store.getState().selectedId).toBeNull();
    expect(store.getState().canUndo).toBe(false);
  });

  it('navigates names from every action, retains native activation, and matches duplicate/long names by stable ID', () => {
    const project = layerNavigationProject(3);
    project.layers[0].name = 'North '.repeat(20);
    project.layers[1].name = 'Same name';
    project.layers[2].name = 'SAME NAME';
    const { store } = setup(project);
    filter('sAmE');
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowDown' });
    expect(selection('place-2')).toHaveFocus();
    fireEvent.keyDown(selection('place-2'), { key: 'End' });
    expect(selection('place-3')).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Lock SAME NAME' }), { key: 'Home' });
    expect(selection('place-2')).toHaveFocus();
    expect(store.getState().selectedId).toBeNull();
    fireEvent.click(selection('place-2'));
    expect(store.getState().selectedId).toBe('place-2');
    expect(tabStops().every((button) => button.closest('li')?.dataset.layerId === 'place-2')).toBe(true);
  });

  it('activates action-focused rows without selecting, retaining visibility, lock and reorder policy', () => {
    const { store } = setup();
    const lock = screen.getByRole('button', { name: 'Lock Keep C' });
    act(() => lock.focus());
    fireEvent.click(lock);
    fireEvent.click(screen.getByRole('button', { name: 'Hide Keep C' }));
    expect(store.getState().selectedId).toBeNull();
    expect(store.getState().document.layers[4]).toMatchObject({ locked: true, visible: false });
    expect(tabStops().every((button) => button.closest('li')?.dataset.layerId === 'place-5')).toBe(true);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Keep C' }), { key: 'ArrowUp', altKey: true });
    expect(store.getState().document.layers[3].id).toBe('place-5');
    expect(screen.getByRole('button', { name: 'Reorder Paper basemap' })).toBeDisabled();
  });

  it('keeps local filtering across collapse/mobile close, clears empty results, and resets on epoch replacement', () => {
    const { store, props, refresh } = setup();
    const before = store.getState().document;
    filter('absent');
    expect(tabStops()).toHaveLength(0);
    expect(screen.getByRole('status', { name: 'Layer navigation' })).toHaveTextContent('0 of 6 layers');
    props.desktopCollapsed = true;
    refresh();
    props.desktopCollapsed = false;
    props.activePanel = 'layers';
    refresh();
    props.activePanel = null;
    refresh();
    expect(screen.getByRole('searchbox')).toHaveValue('absent');
    expect(store.getState().document).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Clear layer filter' }));
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(tabStops()).toHaveLength(4);
    filter('absent');
    act(() => store.getState().openDocument(layerNavigationProject(2)));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('status', { name: 'Layer navigation' })).toHaveTextContent('3 layers');
  });

  it('repairs a deleted focused row to the next visible name and keeps that ID through Undo/Redo', () => {
    const { store } = setup();
    filter('keep');
    act(() => selection('place-3').focus());
    act(() => store.getState().deleteLayer('place-3'));
    expect(selection('place-5')).toHaveFocus();
    act(() => store.getState().undo());
    expect(selection('place-5')).toHaveFocus();
    act(() => store.getState().redo());
    expect(selection('place-5')).toHaveFocus();
    expect(tabStops()).toHaveLength(4);
  });

  it('does not steal Properties focus when renaming removes the active row from the filter', () => {
    const { store } = setup();
    filter('keep');
    act(() => selection('place-1').focus());
    const property = screen.getByLabelText('External property');
    act(() => property.focus());
    act(() => store.getState().renameLayer('place-1', 'Renamed outside filter'));
    expect(property).toHaveFocus();
    expect(tabStops().every((button) => button.closest('li')?.dataset.layerId === 'place-3')).toBe(true);
  });

  it('maps Alt+Arrow through visible IDs and supports an exact single Undo/Redo', () => {
    const { store } = setup();
    filter('keep');
    const before = store.getState().document;
    const handle = screen.getByRole('button', { name: 'Reorder Keep A' });
    act(() => handle.focus());
    fireEvent.keyDown(handle, { key: 'ArrowDown', altKey: true });
    const after = store.getState().document;
    expect(after.layers.map((layer) => layer.id)).toEqual(['place-2', 'place-3', 'place-1', 'place-4', 'place-5', 'basemap']);
    expect(handle).toHaveFocus();
    act(() => store.getState().undo());
    expect(store.getState().document).toEqual(before);
    act(() => store.getState().redo());
    expect(store.getState().document).toEqual(after);
    expect(handle).toHaveFocus();
  });

});

describe('layer reorder ownership and memo boundaries', () => {
  it.each(['Delete', 'Backspace'])('blocks %s of a different selected layer during an active native drag', (key) => {
    const { store, props } = setup();
    act(() => store.getState().selectLayer('place-1'));
    const before = store.getState().document;
    const handle = screen.getByRole('button', { name: 'Reorder Keep B' });
    act(() => handle.focus());
    const drag = startDrag('place-3', 2, new KeyboardEvent('keydown', { code: 'Space' }));
    fireEvent.keyDown(handle, { key });
    expect(store.getState().document).toBe(before);
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().selectedId).toBe('place-1');
    expect(props.onKeyDown.mock.calls.at(-1)?.[0].defaultPrevented).toBe(true);
    drag.finish(2);
  });

  it('retains document/query ownership after dragend until native completion, then unsubscribes', () => {
    const { store } = setup();
    const drag = startDrag();
    drag.finish(1);
    const completion = dnd.completions[0];
    expect(completion.options.canRestoreFocus()).toBe(true);
    act(() => store.getState().renameLayer('place-3', 'Changed during drop'));
    expect(completion.invalidate).toHaveBeenCalledOnce();
    expect(completion.options.canRestoreFocus()).toBe(false);
    act(() => completion.options.onComplete());
    act(() => store.getState().renameLayer('place-3', 'Changed after completion'));
    expect(completion.invalidate).toHaveBeenCalledOnce();
  });

  it.each(['filter', 'epoch'] as const)('invalidates a completed drag when its %s changes before native cleanup', (kind) => {
    const { store } = setup();
    const drag = startDrag();
    drag.finish(1);
    const completion = dnd.completions[0];
    if (kind === 'filter') filter('keep');
    else act(() => store.getState().openDocument(layerNavigationProject(5)));
    const documentAfterChange = store.getState().document;
    expect(completion.invalidate).toHaveBeenCalled();
    expect(completion.options.canRestoreFocus()).toBe(false);
    act(() => completion.options.onComplete());
    expect(store.getState().document).toBe(documentAfterChange);
  });

  it('accepts Alt+Arrow immediately after a completed drop while its visual animation is finishing', () => {
    const { store } = setup();
    dnd.manager.dragOperation.status.idle = false;
    dnd.manager.dragOperation.status.dropped = true;
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Keep A' }), { key: 'ArrowDown', altKey: true });
    expect(store.getState().document.layers[1].id).toBe('place-1');
  });

  it('validates the current index before activation, not the previous gesture initial index', () => {
    const { store } = setup();
    act(() => store.getState().moveLayer('place-1', 4));
    const drag = startDrag('place-1', 4, new Event('pointerdown'), 0);
    expect(drag.event.preventDefault).not.toHaveBeenCalled();
    drag.finish(0);
    expect(store.getState().document.layers[0].id).toBe('place-1');
  });

  it('maps a filtered drag destination to canonical order', () => {
    const { store } = setup();
    filter('keep');
    const drag = startDrag();
    drag.finish(2);
    expect(store.getState().document.layers.map((layer) => layer.id)).toEqual(['place-2', 'place-3', 'place-4', 'place-5', 'place-1', 'basemap']);
    expect(screen.getByRole('status', { name: 'Layer navigation' })).toHaveTextContent('position 5 of 6');
  });

  it.each(['filter', 'rename', 'geometry', 'visibility', 'reorder', 'delete', 'epoch'] as const)('retires a drag when %s changes and ignores its late end', (change) => {
    const { store } = setup();
    filter('keep');
    const drag = startDrag();
    act(() => {
      switch (change) {
        case 'filter': { filter('other'); break; }
        case 'rename': { store.getState().renameLayer('place-3', 'Renamed'); break; }
        case 'geometry': { store.getState().setPoiCoordinates('place-3', [16.4, 48.2]); break; }
        case 'visibility': { store.getState().toggleLayerVisibility('place-3'); break; }
        case 'reorder': { store.getState().moveLayer('place-3', 0); break; }
        case 'delete': { store.getState().deleteLayer('place-1'); break; }
        case 'epoch': { store.getState().openDocument(layerNavigationProject(5)); break; }
      }
    });
    const afterChange = store.getState().document;
    expect(dnd.manager.actions.stop).toHaveBeenCalledWith({ canceled: true });
    expect(screen.getByRole('status', { name: 'Layer navigation' })).toHaveTextContent('reorder canceled');
    drag.finish(2);
    expect(store.getState().document).toBe(afterChange);
  });

  it('does not retire a drag on camera or selection changes', () => {
    const { store } = setup();
    filter('keep');
    const drag = startDrag();
    act(() => {
      store.getState().setCameraViewport([16.4, 48.21], 12);
      store.getState().selectLayer('place-3');
    });
    expect(dnd.manager.actions.stop).not.toHaveBeenCalled();
    drag.finish(2);
    expect(store.getState().document.layers[4].id).toBe('place-1');
    expect(store.getState().selectedId).toBe('place-3');
    expect(store.getState().document.camera.center).toEqual([16.4, 48.21]);
  });

  it('rejects a pending pointer activation if its owner changed before drag start', () => {
    const { store } = setup();
    filter('keep');
    const pointer = new MouseEvent('pointerdown', { bubbles: true, button: 0 });
    Object.defineProperty(pointer, 'isPrimary', { value: true });
    fireEvent(screen.getByRole('button', { name: 'Reorder Keep A' }), pointer);
    act(() => store.getState().renameLayer('place-3', 'Renamed'));
    const before = store.getState().document;
    const drag = startDrag('place-1', 0, pointer);
    expect(drag.event.preventDefault).toHaveBeenCalledOnce();
    drag.finish(2);
    expect(store.getState().document).toBe(before);
  });

  it.each(['keyup', 'secondary-pointer'] as const)('does not retire primary-pointer intent for unrelated %s', (kind) => {
    setup();
    const pointer = new MouseEvent('pointerdown', { bubbles: true, button: 0 });
    Object.defineProperties(pointer, { isPrimary: { value: true }, pointerId: { value: 7 } });
    fireEvent(screen.getByRole('button', { name: 'Reorder Keep A' }), pointer);
    if (kind === 'keyup') fireEvent.keyUp(document, { key: 'Shift', code: 'ShiftLeft' });
    else {
      const secondary = new MouseEvent('pointerup', { bubbles: true });
      Object.defineProperty(secondary, 'pointerId', { value: 8 });
      fireEvent(document, secondary);
    }
    const drag = startDrag('place-1', 0, pointer);
    expect(drag.event.preventDefault).not.toHaveBeenCalled();
    drag.finish(0);
  });

  it('releases its active subscription on teardown and ignores a trailing drop', () => {
    const { store, unmount } = setup();
    filter('keep');
    const drag = startDrag();
    unmount();
    act(() => store.getState().renameLayer('place-3', 'Later'));
    expect(dnd.manager.actions.stop).not.toHaveBeenCalled();
    const before = store.getState().document;
    drag.finish(2);
    expect(store.getState().document).toBe(before);
  });

  it('does not send deletion of another selected layer through a merely focused row', () => {
    const { store, props } = setup();
    act(() => store.getState().selectLayer('place-1'));
    act(() => selection('place-5').focus());
    fireEvent.keyDown(selection('place-5'), { key: 'Delete' });
    expect(props.onKeyDown.mock.calls.at(-1)?.[0].defaultPrevented).toBe(true);
    expect(store.getState().selectedId).toBe('place-1');
    expect(store.getState().canUndo).toBe(false);
  });

  it('renders only two active rows on navigation and none on geometry/camera changes in a 300-POI list', () => {
    const { store } = setup(layerNavigationProject());
    expect(dnd.rowRenders).toHaveBeenCalledTimes(300);
    act(() => selection('place-300').focus());
    expect(dnd.rowRenders).toHaveBeenCalledTimes(302);
    act(() => {
      store.getState().setPoiCoordinates('place-300', [16.4, 48.22]);
      store.getState().setCameraViewport([16.4, 48.21], 12);
    });
    expect(dnd.rowRenders).toHaveBeenCalledTimes(302);
    expect(selection('place-300')).toHaveFocus();
  });
});
