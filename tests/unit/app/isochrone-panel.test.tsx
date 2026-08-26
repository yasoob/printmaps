import { render, screen } from '@testing-library/react';
import { IsochronePanel } from '../../../src/app/components/IsochronePanel';

const sharedProps = {
  center: { coordinate: [16.3725, 48.2084] as [number, number], label: 'Vienna' },
  error: null,
  isGenerating: false,
  profile: 'walking' as const,
  onCancel: vi.fn(),
  onGenerate: vi.fn(),
  onMinutesChange: vi.fn(),
  onProfileChange: vi.fn(),
};

describe('IsochronePanel', () => {
  it('explains the provider limit for longer travel-time areas', () => {
    render(<IsochronePanel {...sharedProps} minutes={20} />);

    expect(screen.getByText('Mapbox supports up to 60 minutes. 61–180 minute areas are unavailable with this provider.')).toBeVisible();
  });

  it('marks a fractional duration invalid and gates generation with corrective guidance', () => {
    render(<IsochronePanel {...sharedProps} minutes={12.5} />);

    expect(screen.getByRole('spinbutton', { name: 'Travel time in minutes' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('whole number from 5 to 60 minutes');
    expect(screen.getByRole('button', { name: 'Generate area' })).toBeDisabled();
  });
});
