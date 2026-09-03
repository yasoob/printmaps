import { useCallback, useLayoutEffect, useRef } from "react";

export function useStableEvent<Arguments extends unknown[], Result>(
  callback: (...arguments_: Arguments) => Result,
) {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => { callbackRef.current = callback; }, [callback]);
  return useCallback(
    (...arguments_: Arguments) => callbackRef.current(...arguments_),
    [],
  );
}

export function useOptionalStableEvent<Arguments extends unknown[], Result>(
  callback: ((...arguments_: Arguments) => Result) | undefined,
) {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => { callbackRef.current = callback; }, [callback]);
  const stableCallback = useCallback((...arguments_: Arguments) => {
    const currentCallback = callbackRef.current;
    if (!currentCallback) throw new Error("Optional action is unavailable.");
    return currentCallback(...arguments_);
  }, []);
  return callback ? stableCallback : undefined;
}
