import { useMemo } from 'react';
import { useStableEvent } from './useStableEvent';

export function useSettingActions<T extends object, Result, Key extends keyof T>(
  value: T,
  commit: (value: T) => Result,
  keys: readonly Key[],
): { [Property in Key]: (next: T[Property]) => Result } {
  const change = useStableEvent((key: Key, next: T[Key]) => commit({ ...value, [key]: next }));
  return useMemo(() => {
    const actions = {} as { [Property in Key]: (next: T[Property]) => Result };
    for (const key of keys) actions[key] = (next) => change(key, next);
    return actions;
  }, [change, keys]);
}
