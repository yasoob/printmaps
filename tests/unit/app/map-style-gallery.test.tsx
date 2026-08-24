import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('map style preset gallery', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('filters twelve presets and selects one as a single undoable project change', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole('combobox', { name: 'Map style' })).not.toBeInTheDocument();
    const gallery = screen.getByRole('radiogroup', { name: 'Map style presets' });
    expect(within(gallery).getAllByRole('radio')).toHaveLength(12);
    expect(within(gallery).getByRole('radio', { name: /Paper/ })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Dark theme' }));
    expect(within(gallery).getAllByRole('radio')).toHaveLength(2);
    expect(within(gallery).getByRole('radio', { name: /Night Ink/ })).toBeVisible();
    expect(within(gallery).getByRole('radio', { name: /Blueprint/ })).toBeVisible();

    await user.click(within(gallery).getByRole('radio', { name: /Night Ink/ }));
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'night-ink');
    expect(screen.getByRole('button', { name: 'Select Night Ink basemap' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'paper');
  });

  it('moves focus through the visual grid without changing style until activation', async () => {
    const user = userEvent.setup();
    render(<App />);
    const gallery = screen.getByRole('radiogroup', { name: 'Map style presets' });
    const paper = within(gallery).getByRole('radio', { name: /Paper/ });
    const graphite = within(gallery).getByRole('radio', { name: /Graphite/ });

    paper.focus();
    await user.keyboard('{ArrowRight}');
    expect(graphite).toHaveFocus();
    expect(paper).toBeChecked();
    expect(graphite).not.toBeChecked();

    await user.keyboard('{Enter}');
    expect(graphite).toBeChecked();
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'graphite');
  });
});
