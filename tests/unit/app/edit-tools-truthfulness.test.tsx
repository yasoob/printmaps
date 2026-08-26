import { render, screen } from '@testing-library/react';
import { App } from '../../../src/app/App';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

it('offers only implemented authoring tools and names geographic shapes as areas', () => {
  render(<App autosaveRepository={null} />);

  expect(screen.getByRole('button', { name: 'Area (S)' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Shape (S)' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Text (T)' })).not.toBeInTheDocument();
});
