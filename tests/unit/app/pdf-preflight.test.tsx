import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/app/App';
import { createProjectStore } from '../../../src/app/store';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { DEFAULT_EXPORT_PREFLIGHT_LIMITS } from '../../../src/export/preflight';
import type { PreviewPngExporter } from '../../../src/export/previewPng';
import { planPdfExport, runPdfExport } from '../../../src/app/components/exportDialogPdf';
import { NATIVE_SYMBOL_BUFFER_PX } from '../../../src/app/components/exportDialogRaster';
import { exportMocks } from './exportMocks';

vi.mock('../../../src/map/MapCanvas', async () => import('./MapCanvasMock'));

function largeDocument() {
  const store = createProjectStore(createInitialProjectDocument());
  store.getState().setPageDimension('widthMm', 1330);
  store.getState().setPageDimension('heightMm', 1330);
  return store.getState().document;
}

function exporterSpy() {
  return Object.assign(vi.fn<PreviewPngExporter>(), {
    createPrintTileRenderer: vi.fn<NonNullable<PreviewPngExporter['createPrintTileRenderer']>>(),
  });
}

afterEach(() => { exportMocks.exporter = null; });

it('blocks the actual unsafe PDF plan before capture, independently of safe alternative formats', async () => {
  const user = userEvent.setup();
  const exporter = exporterSpy();
  exportMocks.exporter = exporter;
  const document = largeDocument();
  expect(planPdfExport(document).safe).toBe(false);
  render(<App initialDocument={document} autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Export' }));
  const dialog = screen.getByRole('dialog', { name: 'Export map' });
  await user.click(within(dialog).getByRole('radio', { name: /PDF/ }));
  expect(within(dialog).getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  const message = within(dialog).getByRole('alert');
  expect(message).toHaveTextContent('512 MiB safety limit');
  expect(message).toHaveTextContent('Reduce the page dimensions');
  expect(message).toHaveTextContent('preview-resolution raster basemap');
  expect(message).not.toHaveTextContent('882993928');
  expect(exporter).not.toHaveBeenCalled();
  expect(exporter.createPrintTileRenderer).not.toHaveBeenCalled();

  await user.click(within(dialog).getByRole('radio', { name: /Layered SVG/ }));
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Download layered SVG' })).toBeEnabled();
  await user.click(within(dialog).getByRole('radio', { name: /PDF/ }));
  expect(within(dialog).getByRole('button', { name: 'Download PDF' })).toBeDisabled();
});

it('allows PDF again after a real page-size correction without retaining the obsolete error', async () => {
  const user = userEvent.setup();
  exportMocks.exporter = exporterSpy();
  render(<App initialDocument={largeDocument()} autosaveRepository={null} />);
  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(screen.getByRole('radio', { name: /PDF/ }));
  expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Close export' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Page preset' }), 'A4');
  await user.click(screen.getByRole('button', { name: 'Export' }));
  await user.click(screen.getByRole('radio', { name: /PDF/ }));
  expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('uses the same hard preflight and readable guidance when the PDF runner is called directly', async () => {
  const exporter = exporterSpy();
  const setError = vi.fn();
  const setBusy = vi.fn();
  await runPdfExport({
    document: largeDocument(), exporter, filename: 'oversized',
    abortControllerRef: createRef(), setError, setBusy, setStatus: vi.fn(),
  });
  expect(setError).toHaveBeenCalledWith(expect.stringContaining('512 MiB safety limit'));
  expect(setError).toHaveBeenCalledWith(expect.stringContaining('choose Layered SVG'));
  expect(exporter).not.toHaveBeenCalled();
  expect(exporter.createPrintTileRenderer).not.toHaveBeenCalled();
  expect(setBusy).not.toHaveBeenCalled();
});

it('keeps the native symbol buffer in the shared PDF plan', () => {
  const document = createInitialProjectDocument();
  expect(planPdfExport(document).plan?.overlapPx).toBe(NATIVE_SYMBOL_BUFFER_PX);
  document.style.visibility.labels = false;
  expect(planPdfExport(document).plan?.overlapPx).toBe(DEFAULT_EXPORT_PREFLIGHT_LIMITS.tileOverlapPx);
});
