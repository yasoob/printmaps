import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteLayerProperties } from '../../../src/app/components/RouteLayerProperties';
import type { ContentLayer } from '../../../src/domain/project';

const arcRoute: ContentLayer = {
  id: 'arc',
  name: 'Arc route',
  type: 'route',
  visible: true,
  locked: false,
  opacity: 100,
  appearance: {
    kind: 'route',
    color: '#d9363e',
    width: 4,
    travelMarker: 'air',
  },
  geometry: {
    type: 'Arc',
    anchors: [[0, 0], [1, 0], [2, 0]],
    curvatures: [0.35, -0.4],
  },
};

it('exposes Arc coordinates, structure, and per-segment curvature controls', async () => {
  const user = userEvent.setup();
  const onArcCurvatureChange = vi.fn();
  const onRouteVertexChange = vi.fn();
  const onRouteVertexInsert = vi.fn();
  const onRouteVertexRemove = vi.fn();
  render(
    <RouteLayerProperties
      layer={arcRoute}
      onAppearanceChange={vi.fn()}
      onArcCurvatureChange={onArcCurvatureChange}
      onRouteVertexChange={onRouteVertexChange}
      onRouteVertexInsert={onRouteVertexInsert}
      onRouteVertexRemove={onRouteVertexRemove}
    />,
  );

  await user.click(screen.getByRole('button', { name: /Advanced/ }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Arc segment' }), '1');
  const amount = screen.getByRole('spinbutton', { name: 'Arc curvature amount' });
  expect(amount).toHaveValue(0.4);
  await user.clear(amount);
  await user.type(amount, '0.6');
  await user.tab();
  expect(onArcCurvatureChange).toHaveBeenCalledWith(1, -0.6);
  await user.click(screen.getByRole('button', { name: 'Flip arc direction' }));
  expect(onArcCurvatureChange).toHaveBeenCalledWith(1, 0.4);

  const longitude = screen.getByRole('textbox', { name: 'Route anchor longitude' });
  longitude.focus();
  await user.clear(longitude);
  await user.type(longitude, '1.25');
  await user.tab();
  expect(onRouteVertexChange).toHaveBeenCalledWith(0, [1.25, 0]);
  await user.click(screen.getByRole('button', { name: 'Insert route anchor after selected' }));
  expect(onRouteVertexInsert).toHaveBeenCalledWith(0);
  await user.click(screen.getByRole('button', { name: 'Remove selected route anchor' }));
  expect(onRouteVertexRemove).toHaveBeenCalledWith(1);
});
