import { ProjectFileError } from './projectFileError';

export function studioObject(value: unknown, label: string, keys?: readonly string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new ProjectFileError(`${label} must be a plain JSON object.`);
  }
  const allowedKeys = keys && new Set(keys);
  if (allowedKeys && Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new ProjectFileError(`${label} contains an unsupported setting.`);
  }
  return value as Record<string, unknown>;
}

export function studioBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new ProjectFileError(`${label} must be true or false.`);
  return value;
}

export function studioNumber(value: unknown, label: string, range: readonly [number, number], isInteger = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < range[0] || value > range[1]
    || (isInteger && !Number.isSafeInteger(value))) {
    throw new ProjectFileError(`${label} must be ${isInteger ? 'a whole number' : 'finite'} between ${range[0]} and ${range[1]}.`);
  }
  return value;
}

export function studioEnum<const T extends string | number>(value: unknown, label: string, options: readonly T[]): T {
  const matched = options.find((option) => option === value);
  if (matched === undefined) throw new ProjectFileError(`${label} is not supported.`);
  return matched;
}

export function studioString(value: unknown, label: string, maximum = 200): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some((character) => (
    character.codePointAt(0)! < 32 && !['\n', '\r', '\t'].includes(character)
  ))) {
    throw new ProjectFileError(`${label} must be text of at most ${maximum} characters without control characters.`);
  }
  return value;
}

export function studioId(value: unknown, label: string): string {
  const id = studioString(value, label);
  if (!id.trim()) throw new ProjectFileError(`${label} must not be empty.`);
  return id;
}

export function studioReference(value: unknown, label: string): string | null {
  return value === null ? null : studioId(value, label);
}

export function studioColor(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) {
    throw new ProjectFileError(`${label} must be a six-digit hex color.`);
  }
  return value.toLowerCase();
}

export function freezeStudioValue<T extends object>(value: T): T {
  for (const child of Object.values(value)) {
    if (typeof child === 'object' && child !== null && !Object.isFrozen(child)) freezeStudioValue(child);
  }
  return Object.freeze(value);
}

// Cache only parser-owned deep-frozen outputs, never mutable caller inputs.
export function cachedStudioValue<T extends object>(
  value: unknown,
  parse: (value: unknown) => T,
  cache?: WeakMap<object, T>,
): T {
  const cached = typeof value === 'object' && value !== null ? cache?.get(value) : undefined;
  if (cached) return cached;
  const parsed = freezeStudioValue(parse(value));
  cache?.set(parsed, parsed);
  return parsed;
}
