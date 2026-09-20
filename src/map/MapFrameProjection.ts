export type MapFrameProjection = Readonly<{
  projectToFrame: (coordinate: readonly [number, number]) => Readonly<{ x: number; y: number }>;
  referenceLongitude: number;
  bearing: number;
  pitch: number;
  frame: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;

export type FrameProjectionMap = {
  getCanvas: () => HTMLCanvasElement;
  getCenter: () => { lng: number };
  getBearing: () => number;
  getPitch: () => number;
  project: (coordinate: [number, number]) => { x: number; y: number };
  on: (event: 'move' | 'resize', listener: () => void) => unknown;
  off: (event: 'move' | 'resize', listener: () => void) => unknown;
};

// Live preview only. Exporters must use a detached render snapshot instead.
export function observeMapFrameProjection(
  map: FrameProjectionMap,
  resolveFrame: () => HTMLElement | null | undefined,
  onChange: (projection: MapFrameProjection | null) => void,
): () => void {
  let isActive = true;
  let scheduled: number | null = null;
  const publish = () => {
    scheduled = null;
    if (!isActive) return;
    const bounds = resolveFrame()?.getBoundingClientRect();
    const canvas = map.getCanvas().getBoundingClientRect();
    if (!bounds || [bounds.width, bounds.height, canvas.width, canvas.height]
      .some((value) => !Number.isFinite(value) || value <= 0)) {
      onChange(null);
      return;
    }
    const frame = {
      x: bounds.left - canvas.left, y: bounds.top - canvas.top,
      width: bounds.width, height: bounds.height,
    };
    onChange({
      frame,
      referenceLongitude: map.getCenter().lng,
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      projectToFrame: (coordinate) => {
        if (!isActive) throw new Error('The map preview projection is no longer available.');
        const point = map.project([coordinate[0], coordinate[1]]);
        return { x: (point.x - frame.x) / frame.width, y: (point.y - frame.y) / frame.height };
      },
    });
  };
  const schedule = () => {
    if (isActive && scheduled === null) scheduled = requestAnimationFrame(publish);
  };
  map.on('move', schedule);
  map.on('resize', schedule);
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
  observer?.observe(map.getCanvas());
  const frame = resolveFrame();
  if (frame) observer?.observe(frame);
  schedule();
  return () => {
    isActive = false;
    if (scheduled !== null) cancelAnimationFrame(scheduled);
    observer?.disconnect();
    map.off('move', schedule);
    map.off('resize', schedule);
    onChange(null);
  };
}
