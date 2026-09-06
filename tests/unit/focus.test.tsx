import { render, screen } from '@testing-library/react';
import { isInteractiveElement, panelTabStops } from '../../src/lib/focus';

it('excludes hidden, inert, disabled, and non-tabbable controls from panel focus cycles', () => {
  const { container } = render(
    <section>
      <button type="button">Visible</button>
      <button type="button" style={{ display: 'none' }}>Hidden by CSS</button>
      <div hidden><button type="button">Hidden ancestor</button></div>
      <div inert><button type="button">Inert ancestor</button></div>
      <fieldset disabled><input aria-label="Disabled field" /></fieldset>
      <input type="hidden" value="not interactive" readOnly />
      <button type="button" tabIndex={-1}>Not a tab stop</button>
      <textarea aria-label="Notes" />
      <a href="#example">Link</a>
    </section>,
  );
  expect(panelTabStops(container)).toEqual([
    screen.getByRole('button', { name: 'Visible' }),
    screen.getByRole('textbox', { name: 'Notes' }),
    screen.getByRole('link', { name: 'Link' }),
  ]);
});

it('keeps visually represented native controls focusable and rejects detached targets', () => {
  render(<input aria-label="Custom checkbox" type="checkbox" style={{ opacity: 0 }} />);
  expect(isInteractiveElement(screen.getByRole('checkbox'))).toBe(true);
  expect(isInteractiveElement(document.createElement('button'))).toBe(false);
  expect(panelTabStops(null)).toEqual([]);
});
