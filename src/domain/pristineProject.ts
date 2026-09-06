import { createNewProjectDocument, type ProjectDocument } from './project';

function orderedObject(_key: string, value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  // Object.entries owns this array; keep the comparator compatible with our ES2022 target.
  // eslint-disable-next-line unicorn/no-array-sort
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

const PRISTINE_PROJECT = JSON.stringify(createNewProjectDocument(), orderedObject);

export function isPristineProjectDocument(document: ProjectDocument): boolean {
  if (document.layers.length !== 1 || Object.keys(document.assets).length > 0) return false;
  return JSON.stringify(document, orderedObject) === PRISTINE_PROJECT;
}
