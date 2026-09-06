import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';
import { markerCapacityProject, markerPng, smallCircleSvg } from '../../fixtures/customMarkerCapacity';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { LayerProperties } from '../../../src/app/components/LayerProperties';

const { decodeCustomMarkerImage } = vi.hoisted(() => ({
  decodeCustomMarkerImage: vi.fn(async () => ({})),
}));

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));
vi.mock('../../../src/domain/customMarkerAssets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/domain/customMarkerAssets')>();
  return { ...actual, decodeCustomMarkerImage };
});

function svgMarker(size = 100) {
  return new File([
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} 120"><path fill="#0d78b5" d="M50 0L100 120H0Z"/></svg>`,
  ], 'custom-pin.svg', { type: 'image/svg+xml' });
}

describe('custom POI marker controls', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
    decodeCustomMarkerImage.mockReset();
    decodeCustomMarkerImage.mockResolvedValue({});
  });

  it('uploads and removes a validated custom marker through undoable project edits', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    expect(screen.getByRole('button', { name: 'Upload custom marker' })).toBeEnabled();

    await user.upload(screen.getByLabelText('Custom marker file'), svgMarker());

    expect(await screen.findByRole('status', { name: 'Custom marker status' })).toHaveTextContent('100 × 120');
    expect(screen.getByRole('button', { name: 'Replace custom marker' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove custom marker' })).toBeEnabled();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-layer-state', expect.stringContaining('custom:sha256-'));

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Remove custom marker' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(await screen.findByRole('button', { name: 'Remove custom marker' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Remove custom marker' }));
    expect(screen.queryByRole('button', { name: 'Remove custom marker' })).not.toBeInTheDocument();
  });

  it('contains an invalid marker and leaves history unchanged', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));

    await user.upload(screen.getByLabelText('Custom marker file'), new File([markerPng(99, 100)], 'small.png', { type: 'image/png' }));

    expect(await screen.findByRole('alert', { name: 'Custom marker error' })).toHaveTextContent('at least 100 × 100');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('accepts a small SVG and disables only the custom image overrides, restoring dormant style on removal and Undo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    await user.selectOptions(screen.getByLabelText('POI marker shape'), 'diamond');
    await user.selectOptions(screen.getByLabelText('POI marker symbol'), 'coffee');
    fireEvent.change(screen.getByLabelText('POI color'), { target: { value: '#123456' } });
    await user.upload(screen.getByLabelText('Custom marker file'), new File([smallCircleSvg], '24.svg', { type: 'image/svg+xml' }));
    expect(await screen.findByRole('status', { name: 'Custom marker status' })).toHaveTextContent('24 × 24 SVG units · Scalable');
    for (const label of ['POI color', 'POI marker shape', 'POI marker symbol']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(expect.stringContaining('custom image supplies'));
    }
    for (const label of ['POI marker size', 'POI label', 'Layer opacity']) expect(screen.getByLabelText(label)).toBeEnabled();
    const size = screen.getByLabelText('POI marker size');
    await user.clear(size); await user.type(size, '48'); await user.tab();
    expect(screen.getByLabelText('POI marker size')).toBe(size);
    await user.click(screen.getByRole('button', { name: 'Remove custom marker' }));
    expect(screen.getByLabelText('POI color')).toBeEnabled();
    expect(screen.getByLabelText('POI color')).toHaveValue('#123456');
    expect(screen.getByLabelText('POI marker shape')).toHaveValue('diamond');
    expect(screen.getByLabelText('POI marker symbol')).toHaveValue('coffee');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText('POI marker shape')).toBeDisabled();
  });

  it('displays aggregate rejection, keeps upload retryable and succeeds after freeing capacity', async () => {
    const user = userEvent.setup();
    render(<App initialDocument={markerCapacityProject('count')} />);
    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    await user.upload(screen.getByLabelText('Custom marker file'), svgMarker());
    expect(await screen.findByRole('alert', { name: 'Custom marker error' })).toHaveTextContent('64 custom marker assets');
    expect(screen.getByRole('alert', { name: 'Custom marker error' })).toHaveTextContent('try again');
    expect(screen.getByRole('button', { name: 'Upload custom marker' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Select Marker 0' }));
    await user.click(screen.getByRole('button', { name: 'Remove custom marker' }));
    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    await user.upload(screen.getByLabelText('Custom marker file'), svgMarker());
    expect(await screen.findByRole('status', { name: 'Custom marker status' })).toBeInTheDocument();
    expect(screen.queryByRole('alert', { name: 'Custom marker error' })).not.toBeInTheDocument();
  });

  it('retires a pending decode when the same selected layer ID is reused by a newer document epoch', async () => {
    const user = userEvent.setup();
    const layer = createInitialProjectDocument().layers.find(({ id }) => id === 'poi-cafe')!;
    const commit = vi.fn(() => ({ ok: true as const }));
    const actions = {
      assets: {}, onAppearanceChange: commit, onDelete: vi.fn(), onDuplicate: commit,
      onOpacityChange: commit, onPoiCoordinatesChange: commit, onPoiCustomMarkerChange: commit,
      onReplace: vi.fn(), onRouteVertexInsert: commit, onRouteVertexRemove: commit,
      onRouteVertexChange: commit, onShapeVertexChange: commit, onRename: commit,
      onToggleLock: commit, onToggleVisibility: commit,
    };
    const { rerender } = render(<LayerProperties layer={layer} documentEpoch={1} {...actions} />);
    let finish!: (value: object) => void;
    decodeCustomMarkerImage.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await user.upload(screen.getByLabelText('Custom marker file'), svgMarker());
    await waitFor(() => expect(finish).toBeDefined());
    rerender(<LayerProperties layer={{ ...layer }} documentEpoch={2} {...actions} />);
    await act(async () => { finish({}); await Promise.resolve(); });
    expect(commit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Upload custom marker' })).toBeEnabled();
  });

  it.each(['selection', 'project', 'undo', 'unmount'])('retires a pending decode on %s without attaching to a newer owner', async (transition) => {
    const user = userEvent.setup();
    const { container, unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    if (transition === 'undo') {
      await user.upload(screen.getByLabelText('Custom marker file'), svgMarker());
      await screen.findByRole('status', { name: 'Custom marker status' });
    }
    let finish!: (value: object) => void;
    decodeCustomMarkerImage.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await user.upload(screen.getByLabelText('Custom marker file'), svgMarker(120));
    await waitFor(() => expect(finish).toBeDefined());
    switch (transition) {
      case 'selection': {
        await user.click(screen.getByRole('button', { name: 'Select City center' }));
        break;
      }
      case 'undo': {
        await user.click(screen.getByRole('button', { name: 'Undo' }));
        break;
      }
      case 'unmount': {
        unmount();
        break;
      }
      case 'project': {
        const replacement = { ...createInitialProjectDocument(), title: 'Replacement' };
        const input = container.querySelector<HTMLInputElement>('input[accept^=".printmap.json"]');
        if (!input) throw new Error('Project file input unavailable');
        fireEvent.change(input, { target: { files: [new File([JSON.stringify(replacement)], 'other.printmap.json')] } });
        await user.click(await screen.findByRole('button', { name: 'Replace project' }));
        await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
        break;
      }
    }
    await act(async () => { finish({}); await Promise.resolve(); });
    if (transition !== 'unmount') {
      expect(screen.getByTestId('map-canvas')).not.toHaveAttribute('data-layer-state', expect.stringContaining('custom:sha256-'));
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    }
  });

  it('does not reattach a replacement that finishes decoding after removal', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Select Coffee stop' }));
    await user.upload(screen.getByLabelText('Custom marker file'), svgMarker());
    expect(await screen.findByRole('button', { name: 'Remove custom marker' })).toBeEnabled();

    let resolveReplacement!: (image: object) => void;
    decodeCustomMarkerImage.mockImplementationOnce(() => new Promise((resolve) => {
      resolveReplacement = resolve;
    }));
    await user.upload(screen.getByLabelText('Custom marker file'), svgMarker(120));
    expect(screen.getByRole('button', { name: 'Replace custom marker' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Remove custom marker' }));
    await act(async () => {
      resolveReplacement({});
      await Promise.resolve();
    });

    expect(screen.queryByRole('button', { name: 'Remove custom marker' })).not.toBeInTheDocument();
    expect(screen.getByTestId('map-canvas')).not.toHaveAttribute('data-layer-state', expect.stringContaining('custom:sha256-'));
  });
});
