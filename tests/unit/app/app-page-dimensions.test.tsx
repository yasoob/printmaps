import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

describe('editor page dimensions', () => {
  beforeEach(() => {
    exportMocks.exporter = null;
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
});
