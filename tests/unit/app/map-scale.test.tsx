import { render, screen } from '@testing-library/react';
import { MapScale } from '../../../src/app/components/MapScale';
import { calculateMapScale } from '../../../src/app/components/mapScaleMath';

describe('live map scale', () => {
  it('chooses a readable metric distance and changes with zoom', () => {
    const wide = calculateMapScale(0, 10, 96);
    const close = calculateMapScale(0, 14, 96);

    expect(wide.label).toBe('5 km');
    expect(close.label).toBe('200 m');
    expect(wide.widthPx).toBeGreaterThan(40);
    expect(close.widthPx).toBeGreaterThan(40);
  });

  it('updates the visible scale as the camera changes', () => {
    const { rerender } = render(<MapScale latitude={0} zoom={10} />);
    const scale = screen.getByLabelText('Map scale: 5 km');
    const initialWidth = scale.getAttribute('style');

    rerender(<MapScale latitude={0} zoom={14} />);
    expect(screen.getByLabelText('Map scale: 200 m')).toBeInTheDocument();
    expect(scale.getAttribute('style')).not.toBe(initialWidth);
  });
});
