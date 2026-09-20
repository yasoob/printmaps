import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

const disclosureKeys = [
  'page',
  'map-style',
  'camera-location',
  'map-details',
].map((section) => `print-map-studio:inspector:project:${section}`);

describe('project inspector disclosure', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
    for (const key of disclosureKeys) window.localStorage.removeItem(key);
  });

  it('shows primary summaries and keeps advanced project controls collapsed by default', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
    expect(document.querySelector('.properties-title .eyebrow')).toBeNull();

    expect(screen.queryByRole('button', { name: 'Page' })).not.toBeInTheDocument();
    const mapStyle = screen.getByRole('button', { name: 'Style' });
    const camera = screen.getByRole('button', { name: 'View' });
    const details = screen.getByRole('button', { name: 'Labels & details' });
    expect(mapStyle).toHaveAttribute('aria-expanded', 'true');
    expect(camera).toHaveAttribute('aria-expanded', 'false');
    expect(camera).toHaveTextContent('0° bearing · 0° pitch · Unlocked');
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(details).toHaveTextContent('7 of 7 visible');
    expect(screen.queryByRole('button', { name: /Provider services/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check.*connection/i })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search places and addresses' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Output settings/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Bearing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Show roads' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    camera.focus();
    await user.keyboard('{Enter}');
    expect(camera).toHaveAttribute('aria-expanded', 'true');
    expect(camera).not.toHaveTextContent('0° bearing · 0° pitch · Unlocked');
    expect(screen.getByRole('spinbutton', { name: 'Bearing' })).toBeInTheDocument();

    await user.click(camera);
    expect(camera).toHaveTextContent('0° bearing · 0° pitch · Unlocked');
  });

  it('restores project disclosure preferences after the inspector remounts', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    const camera = screen.getByRole('button', { name: 'View' });

    await user.click(camera);
    expect(camera).toHaveAttribute('aria-expanded', 'true');
    first.unmount();
    render(<App />);

    expect(screen.getByRole('button', { name: 'View' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('spinbutton', { name: 'Bearing' })).toBeInTheDocument();
  });
});
