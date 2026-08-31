import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('map style preset gallery', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
  });

  it('shows twelve preview-first presets and selects one as a single undoable project change', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole('combobox', { name: 'Map style' })).not.toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: 'Map style theme families' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Preview data/)).not.toBeInTheDocument();
    const gallery = screen.getByRole('radiogroup', { name: 'Map style presets' });
    expect(within(gallery).getAllByRole('radio')).toHaveLength(12);
    expect(within(gallery).getByRole('radio', { name: /Paper/ })).toBeChecked();
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

  it('moves into color customization, keeps overrides clear, and returns focus to the main inspector', async () => {
    const user = userEvent.setup();
    render(<App />);

    const customize = screen.getByRole('button', { name: /Customize colors/ });
    await user.click(customize);
    const heading = screen.getByRole('heading', { name: 'Customize map' });
    expect(heading).toHaveFocus();
    expect(screen.queryByRole('heading', { name: 'Quick Tune' })).not.toBeInTheDocument();
    expect(screen.queryByText('Paper base')).not.toBeInTheDocument();
    expect(screen.queryByText('Linked')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Warm' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Contrast' }), { target: { value: '72' } });
    fireEvent.input(screen.getByLabelText('Water color'), { target: { value: '#123456' } });
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-style-customized', 'true');
    expect(screen.getByLabelText('Reset Water color')).toBeEnabled();

    fireEvent.pointerDown(screen.getByLabelText('Water color'));
    fireEvent.input(screen.getByLabelText('Water color'), { target: { value: '#654321' } });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText('Water color')).toHaveValue('#123456');

    await user.click(screen.getByLabelText('Reset Water color'));
    expect(screen.getByLabelText('Reset Water color')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Back to project properties' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Edit custom palette/ })).toHaveFocus());
    expect(screen.getByRole('button', { name: /Edit custom palette/ })).toBeVisible();
  });

  it('can reset the complete map style to Paper from inside the customizer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('radio', { name: /Night Ink/ }));
    await user.click(screen.getByRole('button', { name: /Customize colors/ }));
    await user.click(screen.getByRole('button', { name: 'Warm' }));

    await user.click(screen.getByRole('button', { name: 'Reset to Paper' }));

    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-style-preset', 'paper');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-style-customized', 'false');
    expect(screen.getByRole('button', { name: 'Balanced' })).toHaveAttribute('aria-pressed', 'true');
  });
});
