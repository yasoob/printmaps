export const MAX_PROJECT_LAYERS = 1000;
export const MAX_PROJECT_COORDINATES = 200_000;
export const MAX_PROJECT_NAME_LENGTH = 200;

export function projectNameError(value: string): string | null {
  if (!value.trim()) return 'Enter a non-empty name.';
  if (value.length > MAX_PROJECT_NAME_LENGTH) {
    return `Names must be ${MAX_PROJECT_NAME_LENGTH} characters or fewer. This name has not been applied.`;
  }
  return null;
}

export function boundedGeneratedName(base: string, suffix: string): string {
  let bounded = base.slice(0, MAX_PROJECT_NAME_LENGTH - suffix.length);
  if (/[\uD800-\uDBFF]$/.test(bounded)) bounded = bounded.slice(0, -1);
  return `${bounded.trimEnd()}${suffix}`;
}
