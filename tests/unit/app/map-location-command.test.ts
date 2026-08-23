import { act, renderHook } from '@testing-library/react';
import { useMapLocationCommand } from '../../../src/app/hooks/useMapLocationCommand';

describe('map location command scope', () => {
  it('withdraws a pending map request when the project document changes', () => {
    const view = renderHook(({ documentEpoch }) => useMapLocationCommand(documentEpoch), {
      initialProps: { documentEpoch: 1 },
    });

    act(() => view.result.current.locate([16.37, 48.21], vi.fn()));
    expect(view.result.current.request).toMatchObject({ coordinate: [16.37, 48.21], request: 1 });

    view.rerender({ documentEpoch: 2 });

    expect(view.result.current.request).toEqual({ request: 0 });
  });
});
