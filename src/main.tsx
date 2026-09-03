import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';

const STARTUP_RETRY_KEY = 'print-map-studio:startup-retry';

function isDynamicModuleLoadError(error: unknown): boolean {
  return error instanceof TypeError
    && /dynamically imported module|importing a module script failed/i.test(error.message);
}

function didRetryApplicationStart(error: unknown): boolean {
  if (!isDynamicModuleLoadError(error) || sessionStorage.getItem(STARTUP_RETRY_KEY) === '1') return false;
  sessionStorage.setItem(STARTUP_RETRY_KEY, '1');
  window.location.reload();
  return true;
}

function showStartupError(): void {
  const root = document.querySelector('#root');
  if (!root) return;
  const alert = document.createElement('main');
  alert.className = 'startup-error';
  alert.setAttribute('role', 'alert');
  alert.setAttribute('aria-label', 'Application unavailable');
  const heading = document.createElement('h1');
  heading.textContent = 'Print Map Studio could not start.';
  const message = document.createElement('p');
  message.textContent = 'A required application file could not be loaded. Check your connection and try again.';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Reload application';
  reload.addEventListener('click', () => {
    sessionStorage.removeItem(STARTUP_RETRY_KEY);
    window.location.reload();
  });
  alert.append(heading, message, reload);
  root.replaceChildren(alert);
}

async function startApplication() {
  try {
    if (import.meta.env.DEV && import.meta.env.VITE_REACT_SCAN !== 'false') {
      const reactScan = await import('react-scan');
      const { installReactScanProbe } = await import('./dev/reactScanProbe');
      reactScan.scan({
        enabled: true,
        onRender: installReactScanProbe(),
        showToolbar: true,
      });
    }
    const { mountApp } = await import('./mountApp');
    await mountApp();
    sessionStorage.removeItem(STARTUP_RETRY_KEY);
  } catch (error) {
    if (didRetryApplicationStart(error)) return;
    if (isDynamicModuleLoadError(error)) {
      showStartupError();
      return;
    }
    throw error;
  }
}

void startApplication();
