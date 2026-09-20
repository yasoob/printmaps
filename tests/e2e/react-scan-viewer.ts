import 'maplibre-gl/dist/maplibre-gl.css';
import '../../src/styles.css';

if (!import.meta.env.DEV || import.meta.env.VITE_REACT_SCAN !== 'true') {
  throw new Error('The shared-viewer audit fixture is available only in an explicit development audit.');
}
const { scan } = await import('react-scan');
const { installReactScanProbe } = await import('../../src/dev/reactScanProbe');
scan({ enabled: true, onRender: installReactScanProbe(), showToolbar: false });
const { mountApp } = await import('../../src/mountApp');
await mountApp();
