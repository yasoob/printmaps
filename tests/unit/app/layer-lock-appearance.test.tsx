import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { createArcGeometry } from '../../../src/domain/routeArcGeometry';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it.each(['straight', 'arc'] as const)('keeps %s route styling editable while its geometry is locked', async (kind) => {
  localStorage.removeItem('print-map-studio:inspector:layer:route-advanced');
  const document = createInitialProjectDocument();
  if (kind === 'arc') {
    const route = document.layers.find((layer) => layer.id === 'route-01');
    if (route?.geometry?.type !== 'LineString') throw new Error('Expected the route fixture');
    const arc = createArcGeometry(route.geometry.coordinates);
    if (!arc) throw new Error('Expected valid arc fixture geometry');
    route.geometry = arc;
    route.route = { kind: 'arc', closed: false };
  }
  const user = userEvent.setup();
  render(<App initialDocument={document} autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Select Route 01' }));
  await user.click(screen.getByRole('button', { name: 'Lock Route 01' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  const marker = screen.getByRole('combobox', { name: 'Route marker pictogram' });
  expect(marker).toBeEnabled();
  expect(screen.getByRole('combobox', { name: 'Route semantic leg' })).toBeEnabled();
  expect(screen.getByRole('textbox', { name: 'Route anchor longitude' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Extend end' })).toBeDisabled();
  await user.selectOptions(marker, 'air');
  expect(marker).toHaveValue('air');
});
