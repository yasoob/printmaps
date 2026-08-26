import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapboxServiceStatus } from '../../../src/app/components/MapboxServiceStatus';
import { MapboxProviderError } from '../../../src/services/mapbox';
import type { MapboxConnectionProbe } from '../../../src/services/mapbox/configuration';

describe('Mapbox deployment status', () => {
  it('shows actionable public-token and origin guidance when deployment configuration is missing', () => {
    render(<MapboxServiceStatus token={null} origin="https://studio.example.test" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Mapbox services unavailable');
    expect(alert).toHaveTextContent('VITE_MAPBOX_PUBLIC_ACCESS');
    expect(alert).toHaveTextContent('https://studio.example.test');
    expect(screen.queryByRole('button', { name: 'Check Mapbox connection' })).not.toBeInTheDocument();
  });

  it('checks a configured public token without rendering or persisting its value', async () => {
    const user = userEvent.setup();
    let resolveProbe!: () => void;
    const probe = vi.fn<MapboxConnectionProbe>().mockImplementation(() => new Promise<void>((resolve) => {
      resolveProbe = resolve;
    }));
    const token = 'pk.fake-public-segment.fake-signature';
    const { container } = render(
      <MapboxServiceStatus token={token} origin="https://studio.example.test" probe={probe} />,
    );

    expect(screen.getByText('Public token configured')).toBeInTheDocument();
    expect(container).not.toHaveTextContent(token);
    await user.click(screen.getByRole('button', { name: 'Check Mapbox connection' }));

    expect(screen.getByRole('button', { name: 'Checking Mapbox connection' })).toBeDisabled();
    const [{ signal, token: validatedToken }] = probe.mock.calls[0];
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(validatedToken).toBe(token);
    resolveProbe();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Mapbox accepted this public token from https://studio.example.test',
    );
    expect(container).not.toHaveTextContent(token);
  });

  it('describes search, travel-time Areas, and road routing as active workflows', async () => {
    const user = userEvent.setup();
    render(
      <MapboxServiceStatus
        token="pk.fake-public-segment.fake-signature"
        origin="https://studio.example.test"
        probe={vi.fn<MapboxConnectionProbe>().mockResolvedValue()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Check Mapbox connection' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('This browser connection is ready for provider requests.');
    expect(status).toHaveTextContent(
      'Search, travel-time Areas, and road routing are active.',
    );
    expect(status).not.toHaveTextContent('integration is next');
  });

  it('turns an origin-restriction failure into corrective guidance and permits retry', async () => {
    const user = userEvent.setup();
    const probe = vi.fn<MapboxConnectionProbe>()
      .mockRejectedValueOnce(new MapboxProviderError(
        'HTTP_FORBIDDEN',
        'Mapbox denied this request. Check token scopes and URL restrictions.',
        { status: 403 },
      ))
      .mockResolvedValueOnce();
    render(
      <MapboxServiceStatus
        token="pk.fake-public-segment.fake-signature"
        origin="https://studio.example.test"
        probe={probe}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Check Mapbox connection' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Check token scopes and URL restrictions');
    expect(alert).toHaveTextContent('https://studio.example.test');
    const retry = screen.getByRole('button', { name: 'Retry Mapbox connection' });
    await user.click(retry);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mapbox accepted'));
  });

  it('cancels an in-flight origin check when the status surface unmounts', async () => {
    const user = userEvent.setup();
    let observedSignal: AbortSignal | undefined;
    const probe = vi.fn<MapboxConnectionProbe>().mockImplementation(({ signal }) => {
      observedSignal = signal;
      return new Promise<void>(() => {
        // Intentionally pending until the status surface unmounts and aborts the signal.
      });
    });
    const { unmount } = render(
      <MapboxServiceStatus token="pk.fake-public-segment.fake-signature" probe={probe} />,
    );

    await user.click(screen.getByRole('button', { name: 'Check Mapbox connection' }));
    unmount();

    expect(observedSignal?.aborted).toBe(true);
  });

  it('resets a successful check when the token, origin, or probe changes', async () => {
    const user = userEvent.setup();
    const firstProbe = vi.fn<MapboxConnectionProbe>().mockResolvedValue();
    const secondProbe = vi.fn<MapboxConnectionProbe>().mockResolvedValue();
    const { rerender } = render(
      <MapboxServiceStatus
        token="pk.first-public-segment.first-signature"
        origin="https://first.example.test"
        probe={firstProbe}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Check Mapbox connection' }));
    expect(await screen.findByRole('status')).toHaveTextContent('https://first.example.test');

    rerender(
      <MapboxServiceStatus
        token="pk.second-public-segment.second-signature"
        origin="https://second.example.test"
        probe={secondProbe}
      />,
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Public token configured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check Mapbox connection' })).toBeEnabled();
  });

  it('aborts an in-flight check when its token configuration changes', async () => {
    const user = userEvent.setup();
    let firstSignal: AbortSignal | undefined;
    const firstProbe = vi.fn<MapboxConnectionProbe>().mockImplementation(({ signal }) => {
      firstSignal = signal;
      return new Promise<void>(() => {
        // Intentionally pending until the configuration changes.
      });
    });
    const secondProbe = vi.fn<MapboxConnectionProbe>().mockResolvedValue();
    const { rerender } = render(
      <MapboxServiceStatus token="pk.first-public-segment.first-signature" probe={firstProbe} />,
    );
    await user.click(screen.getByRole('button', { name: 'Check Mapbox connection' }));

    rerender(
      <MapboxServiceStatus token="pk.second-public-segment.second-signature" probe={secondProbe} />,
    );

    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
    expect(screen.getByRole('button', { name: 'Check Mapbox connection' })).toBeEnabled();
  });
});
