import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { createRef } from 'react';
import { PoiSpreadsheetPanel } from '../../../src/app/components/PoiSpreadsheetPanel';
import { RouteVertexControls } from '../../../src/app/components/RouteVertexControls';
import { useCanvasShapeAuthoring } from '../../../src/app/hooks/useCanvasShapeAuthoring';
import type { ProjectMutationResult } from '../../../src/domain/projectMutation';

it('keeps the selected route point when insertion or removal is rejected', () => {
  const reject = vi.fn(() => ({ ok: false as const, error: 'The original route was kept.' }));
  render(<RouteVertexControls coordinates={[[0, 0], [1, 1], [2, 0]]} disabled={false} onChange={reject} onInsert={reject} onRemove={reject} />);
  const selector = screen.getByRole('combobox', { name: 'Route vertex' });
  fireEvent.click(screen.getByRole('button', { name: 'Insert route vertex after selected' }));
  expect(selector).toHaveValue('0');
  fireEvent.change(selector, { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove selected route vertex' }));
  expect(selector).toHaveValue('1');
});

it('retains spreadsheet text and focus when a valid batch is rejected by admission', () => {
  const onSubmit = vi.fn<() => ProjectMutationResult>(() => ({ ok: false, error: 'This project has room for 99 more layers. Nothing was added.' }));
  render(<PoiSpreadsheetPanel documentEpoch={0} onCancel={vi.fn()} onComplete={vi.fn()} onSubmit={onSubmit} />);
  const rows = 'First\t16\t48\nSecond\t17\t49';
  const textarea = screen.getByRole('textbox', { name: 'POI spreadsheet rows' });
  fireEvent.change(textarea, { target: { value: rows } });
  fireEvent.click(screen.getByRole('button', { name: 'Add POIs' }));
  expect(screen.getByRole('alert')).toHaveTextContent('room for 99 more layers');
  expect(textarea).toHaveValue(rows);
  expect(textarea).toHaveFocus();
  onSubmit.mockReturnValue({ ok: true });
  fireEvent.click(screen.getByRole('button', { name: 'Add POIs' }));
  expect(onSubmit).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('keeps a rejected area outline and its unfinished-work signal until successful Finish or explicit Cancel', () => {
  const createShape = vi.fn<() => ProjectMutationResult>(() => ({ ok: false, error: 'Project position limit reached. Nothing was changed.' }));
  const setActiveTool = vi.fn();
  const { result } = renderHook(() => useCanvasShapeAuthoring({
    activeTool: 'shape', isModalOpen: false, isMobileViewport: true, center: [16, 48],
    documentEpoch: 1, layers: [], selectedId: null, onAuthoringChange: vi.fn(),
    onCreateAdministrativeArea: vi.fn(), onCreateIsochroneArea: vi.fn(), onCreateShape: createShape,
    selectToolRef: createRef<HTMLButtonElement>(), setActiveTool, setFitLayerRequest: vi.fn(),
  }));
  act(() => result.current.panelProps.onModeChange('draw'));
  act(() => {
    result.current.addPoint([16, 48]);
    result.current.addPoint([17, 48]);
    result.current.addPoint([17, 49]);
  });
  const outline = result.current.points;
  act(() => result.current.panelProps.onFinish());
  expect(result.current.points).toBe(outline);
  expect(result.current.hasUnfinishedWork).toBe(true);
  expect(result.current.panelProps.pointError).toContain('Project position limit');
  expect(setActiveTool).not.toHaveBeenCalled();
  createShape.mockReturnValue({ ok: true });
  act(() => result.current.panelProps.onFinish());
  expect(result.current.points).toHaveLength(0);
  expect(result.current.hasUnfinishedWork).toBe(false);
  expect(result.current.panelProps.pointError).toBeNull();
  expect(setActiveTool).toHaveBeenCalledWith('select');
});

it('keeps a selected administrative boundary workflow open after rejection', () => {
  const setActiveTool = vi.fn();
  const { result } = renderHook(() => useCanvasShapeAuthoring({
    activeTool: 'shape', isModalOpen: false, isMobileViewport: false, center: [16, 48],
    documentEpoch: 1, layers: [], selectedId: null, onAuthoringChange: vi.fn(),
    onCreateAdministrativeArea: vi.fn(() => ({ ok: false as const, error: 'Project limit reached.' })),
    onCreateIsochroneArea: vi.fn(), onCreateShape: vi.fn(), selectToolRef: createRef<HTMLButtonElement>(),
    setActiveTool, setFitLayerRequest: vi.fn(),
  }));
  act(() => result.current.panelProps.onAddAdministrativeArea({
    id: 'test', name: 'Boundary', countryCode: 'TST', level: 'country', source: 'test',
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] },
  }));
  expect(setActiveTool).not.toHaveBeenCalled();
  expect(result.current.panelProps.admissionError).toBe('Project limit reached.');
});
