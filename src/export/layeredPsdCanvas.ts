export function psdAbortError(): DOMException {
  return new DOMException('Layered PSD export was cancelled.', 'AbortError');
}

export function throwIfPsdCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw psdAbortError();
}

export function releasePsdSurface(surface: HTMLCanvasElement): void {
  surface.width = 0;
  surface.height = 0;
}

export function createPsdSurface(width: number, height: number): Readonly<{
  context: CanvasRenderingContext2D;
  surface: HTMLCanvasElement;
}> {
  const surface = document.createElement('canvas');
  try {
    surface.width = width;
    surface.height = height;
    const context = surface.getContext('2d');
    if (!context) throw new Error('A 2D canvas context is unavailable.');
    return { context, surface };
  } catch {
    releasePsdSurface(surface);
    throw new Error('Layered PSD composition is unavailable in this browser.');
  }
}
