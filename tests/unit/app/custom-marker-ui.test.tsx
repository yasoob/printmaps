import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

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

    await user.upload(screen.getByLabelText('Custom marker file'), svgMarker(99));

    expect(await screen.findByRole('alert', { name: 'Custom marker error' })).toHaveTextContent('at least 100 × 100');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
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
