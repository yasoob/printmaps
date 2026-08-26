# Development tools

## React Scan

React Scan is available as development-only render instrumentation.

```bash
VITE_REACT_SCAN=true npm run dev
```

When enabled, its toolbar appears in the browser and **Outline Re-renders** is active. Leave `VITE_REACT_SCAN` unset (or set it to `false`) for ordinary development and automated browser tests.

The bootstrap loads React Scan before React DOM, then mounts the application. Production builds eliminate the scanner branch and do not contain React Scan code.
