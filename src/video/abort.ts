export function videoAbortError(): DOMException {
  return new DOMException('Video export was cancelled.', 'AbortError');
}

export function requireVideoActive(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? videoAbortError();
}

export function nextVideoFrame(signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? videoAbortError());
      return;
    }
    const abort = () => {
      cancelAnimationFrame(handle);
      reject(signal.reason ?? videoAbortError());
    };
    const handle = requestAnimationFrame((time) => {
      signal.removeEventListener('abort', abort);
      resolve(time);
    });
    signal.addEventListener('abort', abort, { once: true });
  });
}
