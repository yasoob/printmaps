import { useCallback, useLayoutEffect, useRef } from "react";

export function useLatestValue<T>(value: T): () => T {
  const reference = useRef(value);
  useLayoutEffect(() => {
    reference.current = value;
  }, [value]);
  return useCallback(() => reference.current, []);
}
