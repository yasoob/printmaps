import { existsSync, readFileSync } from 'node:fs';

describe('React Scan development instrumentation', () => {
  it('loads before React DOM by default in development only', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const entrypoint = readFileSync('src/main.tsx', 'utf8');
    const mountPath = 'src/mountApp.tsx';
    const mountModule = existsSync(mountPath) ? readFileSync(mountPath, 'utf8') : '';

    expect(packageJson.devDependencies?.['react-scan']).toBeDefined();
    expect(packageJson.dependencies?.['react-scan']).toBeUndefined();
    expect(entrypoint).toContain("import.meta.env.DEV && import.meta.env.VITE_REACT_SCAN !== 'false'");
    expect(entrypoint).toContain("await import('react-scan')");
    expect(entrypoint).toContain("await import('./dev/reactScanProbe')");
    expect(entrypoint).toContain('onRender: installReactScanProbe()');
    expect(entrypoint.indexOf("await import('react-scan')"))
      .toBeLessThan(entrypoint.indexOf("await import('./mountApp')"));
    expect(entrypoint).not.toContain("react-dom/client");
    expect(existsSync(mountPath)).toBe(true);
    expect(mountModule).toContain("import ReactDOM from 'react-dom/client';");
  });
});
