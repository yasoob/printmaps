import { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/App';
import type { ContentLayer } from '../../src/domain/project';

const exportMocks = vi.hoisted(() => ({
  exporter: null as null | (() => Promise<{ blob: Blob; width: number; height: number }>),
}));

vi.mock('../../src/map/MapCanvas', () => ({
  MapCanvas: ({
    layers = [],
    selectedId,
    previewedId,
    onLayerSelect,
    onBackgroundClick,
    onExporterChange,
    fitRequest,
    orientation,
    page,
  }: {
    layers?: ContentLayer[];
    selectedId?: string | null;
    previewedId?: string | null;
    onLayerSelect?: (id: string) => void;
    onBackgroundClick: () => void;
    onExporterChange?: (exporter: typeof exportMocks.exporter) => void;
    fitRequest?: number;
    orientation?: 'landscape' | 'portrait';
    page?: { preset?: string; widthMm: number; heightMm: number };
  }) => {
    useEffect(() => {
      onExporterChange?.(exportMocks.exporter);
      return () => onExporterChange?.(null);
    }, [onExporterChange]);

    return (
      <div
      data-testid="map-canvas"
      data-fit-request={fitRequest}
      data-orientation={orientation}
      data-page-preset={page?.preset}
      data-page-size={page ? `${page.widthMm}x${page.heightMm}` : ''}
      data-layer-state={layers.map(({ id, visible }) => `${id}:${visible}`).join(',')}
      data-selected-layer={selectedId ?? ''}
      data-previewed-layer={previewedId ?? ''}
    >
      <button type="button" onClick={onBackgroundClick}>Map background</button>
      <button type="button" onClick={() => onLayerSelect?.('poi-cafe')}>Map Coffee stop</button>
      </div>
    );
  },
}));

describe('editor selection context', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('synchronizes ordered content state while list hover previews and canvas clicks select', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');
    const coffee = screen.getByRole('button', { name: 'Select Coffee stop' });

    expect(map).toHaveAttribute('data-layer-state', 'route-01:true,poi-cafe:true,area-center:true');
    fireEvent.mouseEnter(coffee);
    expect(map).toHaveAttribute('data-previewed-layer', 'poi-cafe');
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
    fireEvent.mouseLeave(coffee);
    expect(map).toHaveAttribute('data-previewed-layer', '');

    await user.click(screen.getByRole('button', { name: 'Map Coffee stop' }));
    expect(map).toHaveAttribute('data-selected-layer', 'poi-cafe');
    expect(screen.getByRole('heading', { name: 'Coffee stop' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide Route 01' }));
    expect(map).toHaveAttribute('data-layer-state', 'route-01:false,poi-cafe:true,area-center:true');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder City center' }), { key: 'ArrowUp', altKey: true });
    expect(map).toHaveAttribute('data-layer-state', 'route-01:false,area-center:true,poi-cafe:true');
  });

  it('opens Export and reports when the live preview is unavailable', async () => {
    const user = userEvent.setup();
    render(<App />);

    const trigger = screen.getByRole('button', { name: 'Export' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    const download = screen.getByRole('button', { name: 'Download PNG' });
    expect(dialog).toBeInTheDocument();
    expect(download).toHaveFocus();

    await user.click(download);
    expect(screen.getByRole('alert')).toHaveTextContent('live map preview is not ready');
    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps focus contained in the dialog while export is busy', async () => {
    const user = userEvent.setup();
    let finishExport: ((result: { blob: Blob; width: number; height: number }) => void) | undefined;
    exportMocks.exporter = vi.fn(() => new Promise<{ blob: Blob; width: number; height: number }>((resolve) => { finishExport = resolve; }));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export map' });
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    await waitFor(() => expect(dialog).toHaveFocus());
    expect(document.querySelector('.export-backdrop')?.tagName).toBe('DIV');
    await user.keyboard('{Tab}');
    expect(dialog).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(dialog).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveFocus();

    finishExport?.({ blob: new Blob(['png']), width: 100, height: 80 });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Download started'));
  });

  it('clears a hovered layer preview when the layer is hidden', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');
    const route = screen.getByRole('button', { name: 'Select Route 01' });

    fireEvent.mouseEnter(route);
    expect(map).toHaveAttribute('data-previewed-layer', 'route-01');
    await user.click(screen.getByRole('button', { name: 'Hide Route 01' }));
    expect(map).toHaveAttribute('data-previewed-layer', '');
    await user.click(screen.getByRole('button', { name: 'Show Route 01' }));
    expect(map).toHaveAttribute('data-previewed-layer', '');
  });

  it('does not preview a hidden layer on hover', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');

    await user.click(screen.getByRole('button', { name: 'Hide Route 01' }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Select Route 01' }));

    expect(map).toHaveAttribute('data-previewed-layer', '');
  });

  it('clears a preview when its layer is deleted', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');
    const coffee = screen.getByRole('button', { name: 'Select Coffee stop' });

    await user.click(coffee);
    fireEvent.mouseEnter(coffee);
    expect(map).toHaveAttribute('data-previewed-layer', 'poi-cafe');
    fireEvent.click(screen.getByRole('button', { name: 'Layer menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete layer' }));

    expect(map).toHaveAttribute('data-previewed-layer', '');
  });

  it('does not restore a stale preview when a deleted layer is undone', async () => {
    const user = userEvent.setup();
    render(<App />);
    const map = screen.getByTestId('map-canvas');
    const coffee = screen.getByRole('button', { name: 'Select Coffee stop' });

    await user.click(coffee);
    fireEvent.mouseEnter(coffee);
    fireEvent.click(screen.getByRole('button', { name: 'Layer menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete layer' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(map).toHaveAttribute('data-previewed-layer', '');
  });

  it('exposes project fields, tool state, and page disclosure accessibly', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('combobox', { name: 'Page preset' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Map style' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Bearing' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Pitch' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Text scale' })).toBeInTheDocument();
    const exportResolution = screen.getByRole('combobox', { name: 'Export resolution' });
    expect(exportResolution).toHaveValue('Browser preview');
    expect(exportResolution).toBeDisabled();
    const attribution = screen.getByRole('checkbox', { name: 'Include map attribution' });
    expect(attribution).toBeChecked();
    expect(attribution).toBeDisabled();

    const select = screen.getByRole('button', { name: 'Select (V)' });
    const pan = screen.getByRole('button', { name: 'Pan (H)' });
    expect(select).toHaveAttribute('aria-pressed', 'true');
    expect(pan).toHaveAttribute('aria-pressed', 'false');
    await user.click(pan);
    expect(select).toHaveAttribute('aria-pressed', 'false');
    expect(pan).toHaveAttribute('aria-pressed', 'true');

    expect(screen.queryByRole('button', { name: 'Page 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add page' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Map layers' })).toBeInTheDocument();
  });

  it('commits project orientation to history and keeps the canvas and dimensions synchronized', async () => {
    const user = userEvent.setup();
    render(<App />);
    const landscape = screen.getByRole('button', { name: 'Landscape' });
    const portrait = screen.getByRole('button', { name: 'Portrait' });

    expect(landscape).toHaveAttribute('aria-pressed', 'true');
    expect(portrait).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-orientation', 'landscape');
    await user.click(portrait);
    expect(landscape).toHaveAttribute('aria-pressed', 'false');
    expect(portrait).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Page width' })).toHaveValue('210');
    expect(screen.getByRole('textbox', { name: 'Page height' })).toHaveValue('297');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-orientation', 'portrait');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(landscape).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Page width' })).toHaveValue('297');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-orientation', 'landscape');

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(portrait).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-orientation', 'portrait');
  });

  it('applies a standard page preset to properties and canvas as one undoable change', async () => {
    const user = userEvent.setup();
    render(<App />);
    const preset = screen.getByRole('combobox', { name: 'Page preset' });
    const map = screen.getByTestId('map-canvas');

    await user.selectOptions(preset, 'A3');

    expect(preset).toHaveValue('A3');
    expect(screen.getByRole('textbox', { name: 'Page width' })).toHaveValue('420');
    expect(screen.getByRole('textbox', { name: 'Page height' })).toHaveValue('297');
    expect(map).toHaveAttribute('data-page-preset', 'A3');
    expect(map).toHaveAttribute('data-page-size', '420x297');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(preset).toHaveValue('A4');
    expect(screen.getByRole('textbox', { name: 'Page width' })).toHaveValue('297');
    expect(map).toHaveAttribute('data-page-preset', 'A4');
  });

  it('keeps the A4 preset and history unchanged when page width is blurred without editing', async () => {
    const user = userEvent.setup();
    render(<App />);
    const field = screen.getByRole('textbox', { name: 'Page width' });
    const preset = screen.getByRole('combobox', { name: 'Page preset' });
    const undo = screen.getByRole('button', { name: 'Undo' });

    await user.click(field);
    await user.tab();

    expect(preset).toHaveValue('A4');
    expect(undo).toBeDisabled();
  });

  it('commits an unchanged valid page dimension as Custom on blur', async () => {
    const user = userEvent.setup();
    render(<App />);
    const field = screen.getByRole('textbox', { name: 'Page width' });
    const preset = screen.getByRole('combobox', { name: 'Page preset' });
    const undo = screen.getByRole('button', { name: 'Undo' });

    await user.clear(field);
    await user.type(field, '297');
    expect(undo).toBeDisabled();
    await user.tab();

    expect(preset).toHaveValue('Custom');
    expect(undo).toBeEnabled();
    await user.click(undo);
    expect(preset).toHaveValue('A4');
    expect(undo).toBeDisabled();
  });

  it.each([
    { fieldName: 'Page width', nextValue: '240', originalValue: '297', expectedSize: '240x210' },
    { fieldName: 'Page height', nextValue: '180', originalValue: '210', expectedSize: '297x180' },
  ])('validates and commits a custom $fieldName edit once on blur', async ({
    fieldName,
    nextValue,
    originalValue,
    expectedSize,
  }) => {
    const user = userEvent.setup();
    render(<App />);
    const field = screen.getByRole('textbox', { name: fieldName });
    const preset = screen.getByRole('combobox', { name: 'Page preset' });
    const undo = screen.getByRole('button', { name: 'Undo' });
    const map = screen.getByTestId('map-canvas');

    expect(field).not.toHaveAttribute('readonly');
    await user.clear(field);
    await user.type(field, '-1');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(undo).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Project menu' }));
    expect(field).toHaveValue(originalValue);
    expect(preset).toHaveValue('A4');
    expect(undo).toBeDisabled();

    await user.clear(field);
    await user.type(field, nextValue);
    expect(undo).toBeDisabled();
    await user.tab();
    expect(field).toHaveValue(nextValue);
    expect(preset).toHaveValue('Custom');
    expect(map).toHaveAttribute('data-page-size', expectedSize);
    expect(undo).toBeEnabled();

    await user.click(undo);
    expect(screen.getByRole('textbox', { name: fieldName })).toHaveValue(originalValue);
    expect(preset).toHaveValue('A4');
  });

  it('discards a dirty page draft after canonical dimensions change away and back', () => {
    render(<App />);
    const field = screen.getByRole('textbox', { name: 'Page width' });
    const portrait = screen.getByRole('button', { name: 'Portrait' });
    const landscape = screen.getByRole('button', { name: 'Landscape' });
    const undo = screen.getByRole('button', { name: 'Undo' });

    fireEvent.change(field, { target: { value: '240' } });
    expect(field).toHaveValue('240');
    fireEvent.click(portrait);
    expect(screen.getByRole('textbox', { name: 'Page width' })).toHaveValue('210');
    fireEvent.click(landscape);

    const restoredField = screen.getByRole('textbox', { name: 'Page width' });
    expect(restoredField).toHaveValue('297');
    fireEvent.blur(restoredField);
    expect(screen.getByRole('combobox', { name: 'Page preset' })).toHaveValue('A4');
    expect(undo).toBeEnabled();
  });

  it('derives orientation from extreme custom dimensions', async () => {
    const user = userEvent.setup();
    render(<App />);
    const width = screen.getByRole('textbox', { name: 'Page width' });
    await user.clear(width);
    await user.type(width, '100');
    await user.tab();
    const height = screen.getByRole('textbox', { name: 'Page height' });
    await user.clear(height);
    await user.type(height, '300');
    await user.tab();

    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-page-size', '100x300');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-orientation', 'portrait');
    expect(screen.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('fits the page without changing the persistent tool', async () => {
    const user = userEvent.setup();
    render(<App />);
    const pan = screen.getByRole('button', { name: 'Pan (H)' });
    const map = screen.getByTestId('map-canvas');
    expect(map).toHaveAttribute('data-fit-request', '0');
    await user.click(pan);
    await user.click(screen.getByRole('button', { name: 'Fit page (Shift+1)' }));
    expect(pan).toHaveAttribute('aria-pressed', 'true');
    expect(map).toHaveAttribute('data-fit-request', '1');
  });

  it('covers redo, list locking, property toggles, duplication, and deletion focus', async () => {
    const user = userEvent.setup();
    render(<App />);

    const redo = screen.getByRole('button', { name: 'Redo' });
    expect(redo).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Hide Route 01' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(redo).toBeEnabled();
    await user.click(redo);
    expect(screen.getByRole('button', { name: 'Show Route 01' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lock Coffee stop' }));
    expect(screen.getByRole('button', { name: 'Unlock Coffee stop' })).toBeInTheDocument();
    expect(redo).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    const visibleToggle = screen.getByRole('button', { name: 'Toggle layer visibility' });
    const lockToggle = screen.getByRole('button', { name: 'Toggle layer lock' });
    expect(visibleToggle).toHaveAttribute('aria-pressed', 'true');
    expect(lockToggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(visibleToggle);
    expect(visibleToggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(lockToggle);
    expect(lockToggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate layer' }));
    expect(screen.getByRole('heading', { name: 'Coffee stop copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Coffee stop copy' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete layer' }));
    expect(screen.getByRole('button', { name: 'Select City center' })).toHaveFocus();
  });

  it('keeps destructive layer actions in the compact layer menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));

    expect(screen.queryByRole('button', { name: 'Move up' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move down' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicate layer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete layer' })).not.toBeInTheDocument();

    const menuButton = screen.getByRole('button', { name: 'Layer menu' });
    await user.click(menuButton);
    const duplicate = screen.getByRole('menuitem', { name: 'Duplicate layer' });
    expect(duplicate).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete layer' })).toBeInTheDocument();
    expect(duplicate).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete layer' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(duplicate).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menuitem', { name: 'Duplicate layer' })).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  it('reorders layers by dragging a layer handle', () => {
    render(<App />);
    const routeHandle = screen.getByRole('button', { name: 'Reorder Route 01' });
    const coffeeHandle = screen.getByRole('button', { name: 'Reorder Coffee stop' });

    fireEvent.dragStart(routeHandle);
    fireEvent.dragOver(coffeeHandle);
    fireEvent.drop(coffeeHandle);

    expect(screen.getAllByRole('button', { name: /Select (Route 01|Coffee stop)/ }).map((button) => button.getAttribute('aria-label')))
      .toEqual(['Select Coffee stop', 'Select Route 01']);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Route 01' }), { key: 'ArrowUp', altKey: true });
    expect(screen.getAllByRole('button', { name: /Select (Route 01|Coffee stop)/ }).map((button) => button.getAttribute('aria-label')))
      .toEqual(['Select Route 01', 'Select Coffee stop']);
  });

  it('commits a field draft without dropping the directly clicked action', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));

    const name = screen.getByRole('textbox', { name: 'Layer name' });
    await user.clear(name);
    await user.type(name, 'Danube route');
    await user.click(screen.getByRole('button', { name: 'Toggle layer visibility' }));

    expect(screen.getByRole('heading', { name: 'Danube route' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle layer visibility' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('moves focus to Project properties after deleting the final layer', async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const layerName of ['Route 01', 'Coffee stop', 'City center', 'Liberty basemap']) {
      await user.click(screen.getByRole('button', { name: `Select ${layerName}` }));
      await user.click(screen.getByRole('button', { name: 'Layer menu' }));
      await user.click(screen.getByRole('menuitem', { name: 'Delete layer' }));
    }

    expect(screen.getByRole('heading', { name: 'Project' })).toHaveFocus();
    expect(screen.getByText('0 layers')).toBeInTheDocument();
  });

  it('normalizes trimmed names and clamped opacity drafts after blur', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));

    const name = screen.getByRole('textbox', { name: 'Layer name' });
    await user.clear(name);
    await user.type(name, '  Route 01  ');
    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Layer name' })).toHaveValue('Route 01');

    const opacity = screen.getByRole('textbox', { name: 'Layer opacity' });
    await user.clear(opacity);
    await user.type(opacity, '150');
    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Layer opacity' })).toHaveValue('100');
  });

  it('preserves spaces while renaming a layer from its property field', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    const name = screen.getByRole('textbox', { name: 'Layer name' });
    await user.click(name);
    await user.keyboard('{Control>}a{/Control}Danube loop');
    await user.tab();

    expect(screen.getByRole('heading', { name: 'Danube loop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Danube loop' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Select Route 01' })).toBeInTheDocument();
  });

  it('commits an opacity field edit as one undoable change', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const opacity = screen.getByRole('textbox', { name: 'Layer opacity' });
    await user.click(opacity);
    await user.keyboard('{Control>}a{/Control}55');
    await user.tab();
    expect(opacity).toHaveValue('55');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('textbox', { name: 'Layer opacity' })).toHaveValue('28');
  });

  it('ignores an empty opacity edit instead of coercing it to zero', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select City center' }));
    const opacity = screen.getByRole('textbox', { name: 'Layer opacity' });
    expect(opacity).toHaveValue('28');

    await user.clear(opacity);
    await user.tab();
    expect(opacity).toHaveValue('28');
  });

  it('wires layer edits to undoable editor controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Hide Route 01' }));
    expect(screen.getByRole('button', { name: 'Show Route 01' })).toBeInTheDocument();
    expect(undo).toBeEnabled();

    await user.click(undo);
    expect(screen.getByRole('button', { name: 'Hide Route 01' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    await user.click(screen.getByRole('button', { name: 'Layer menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete layer' }));
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Coffee stop' })).not.toBeInTheDocument();

    await user.click(undo);
    expect(screen.getByRole('button', { name: 'Select Coffee stop' })).toBeInTheDocument();
  });

  it('shows project properties until a layer is selected, then returns on canvas click', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Layers sidebar' })).toBeInTheDocument();
    expect(screen.getByText('Local draft')).toBeInTheDocument();
    expect(screen.queryByText('All changes saved locally')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
    expect(screen.getByRole('heading', { name: 'Route 01' })).toBeInTheDocument();
    expect(screen.getByLabelText('Layer opacity')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Map background' }));
    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
  });
});
