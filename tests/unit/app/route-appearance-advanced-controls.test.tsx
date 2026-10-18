import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createDefaultRouteAppearance, type RouteAppearance } from '../../../src/domain/project';
import {
  RouteMarkerControls,
  RouteSegmentControls,
} from '../../../src/app/components/RouteAppearanceAdvancedControls';
import { chooseOption } from '../select-support';

function Controls({ initial, onChange }: {
  initial: RouteAppearance;
  onChange: (appearance: RouteAppearance) => void;
}) {
  const [appearance, setAppearance] = useState(initial);
  const update = (next: RouteAppearance) => {
    setAppearance(next);
    onChange(next);
    return { ok: true as const };
  };
  return (
    <>
      <RouteMarkerControls appearance={appearance} disabled={false} onChange={update} />
      <RouteSegmentControls appearance={appearance} disabled={false} onChange={update} />
    </>
  );
}

describe('advanced marker and semantic-leg controls', () => {
  it('offers all six pictograms and persists placement, orientation, and None without latent state', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Controls initial={createDefaultRouteAppearance(2)} onChange={changed} />);
    const pictogram = screen.getByRole('combobox', { name: 'Route marker pictogram' });
    await user.click(pictogram);
    expect(within(await screen.findByRole('listbox')).getAllByRole('option').map(({ textContent }) => textContent)).toEqual([
      'None', 'Air', 'Train', 'Car', 'Walking', 'Cycling', 'Ship',
    ]);
    await user.keyboard('{Escape}');
    await chooseOption(user, 'Route marker pictogram', 'Air');
    await chooseOption(user, 'Route marker placement', 'Same position per segment');
    await user.clear(screen.getByRole('spinbutton', { name: 'Route marker position percentage' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Route marker position percentage' }), '25');
    await user.click(screen.getByRole('switch', { name: 'Reverse route marker facing' }));
    await user.click(screen.getByRole('switch', { name: 'Orient route marker to path' }));
    expect(screen.queryByRole('switch', { name: 'Reverse route marker facing' })).toBeNull();
    await chooseOption(user, 'Route marker pictogram', 'None');
    expect(changed.mock.calls.at(-1)?.[0].marker).toBeNull();
  });

  it('persists an exact selected-leg override and clears fields back to inheritance', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Controls initial={createDefaultRouteAppearance(2)} onChange={changed} />);
    await chooseOption(user, 'Route semantic leg', 'Leg 2');
    await user.click(screen.getByRole('checkbox', { name: 'Inherit route segment color' }));
    await user.click(screen.getByRole('checkbox', { name: 'Inherit route segment width' }));
    await user.click(screen.getByRole('checkbox', { name: 'Inherit route segment line style' }));
    await chooseOption(user, 'Route segment line style', 'Dashed');
    expect(changed.mock.calls.at(-1)?.[0].segmentStyles).toEqual([
      null,
      { color: '#d9363e', width: 4, strokeStyle: 'dashed' },
    ]);
    const width = screen.getByRole('spinbutton', { name: 'Route segment width' });
    expect(width).toHaveAttribute('min', '0');
    expect(width).not.toHaveAttribute('max');
    fireEvent.change(width, { target: { value: '0' } });
    expect(changed.mock.calls.at(-1)?.[0].segmentStyles).toEqual([
      null,
      { color: '#d9363e', width: 0, strokeStyle: 'dashed' },
    ]);
    await user.click(screen.getByRole('button', { name: 'Clear leg override' }));
    expect(changed.mock.calls.at(-1)?.[0].segmentStyles).toEqual([null, null]);
  });
});
