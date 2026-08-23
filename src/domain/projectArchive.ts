import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { ProjectDocument } from './project';
import { MAX_PROJECT_FILE_BYTES, parseProjectFileText, ProjectFileError } from './projectFile';

export const MAX_PROJECT_ARCHIVE_BYTES = 10 * 1024 * 1024;
export const MAX_PROJECT_ARCHIVE_ENTRY_BYTES = MAX_PROJECT_FILE_BYTES;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MANIFEST_PATH = 'manifest.json';
const PROJECT_PATH = 'project.printmap.json';
const FIXED_ZIP_TIME = new Date(1980, 0, 1);
const ALLOWED_PATHS = new Set([MANIFEST_PATH, PROJECT_PATH]);

type ProjectArchiveManifest = {
  format: 'print-map-studio-project';
  archiveVersion: 1;
  project: typeof PROJECT_PATH;
  assets: [];
};

const PROJECT_ARCHIVE_MANIFEST: ProjectArchiveManifest = {
  format: 'print-map-studio-project',
  archiveVersion: 1,
  project: PROJECT_PATH,
  assets: [],
};

export class ProjectArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectArchiveError';
  }
}

function projectText(document: ProjectDocument): string {
  const text = `${JSON.stringify(document, null, 2)}\n`;
  const bytes = strToU8(text);
  if (bytes.byteLength > MAX_PROJECT_ARCHIVE_ENTRY_BYTES) {
    throw new ProjectArchiveError('The project is too large for a portable ZIP. Project data must be 10 MB or smaller.');
  }
  parseProjectFileText(text);
  return text;
}

export function createProjectArchive(document: ProjectDocument): Uint8Array<ArrayBuffer> {
  const entries = {
    [MANIFEST_PATH]: strToU8(`${JSON.stringify(PROJECT_ARCHIVE_MANIFEST, null, 2)}\n`),
    [PROJECT_PATH]: strToU8(projectText(document)),
  };
  const archive = zipSync(entries, { level: 0, mtime: FIXED_ZIP_TIME });
  if (archive.byteLength > MAX_PROJECT_ARCHIVE_BYTES) {
    throw new ProjectArchiveError('The generated project ZIP is larger than 10 MB. Remove project content before saving.');
  }
  return archive;
}

function parseManifest(bytes: Uint8Array): ProjectArchiveManifest {
  let value: unknown;
  try {
    value = JSON.parse(strFromU8(bytes)) as unknown;
  } catch {
    throw new ProjectArchiveError('The project ZIP manifest is not valid JSON.');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProjectArchiveError('The project ZIP manifest must be an object.');
  }
  const manifest = value as Record<string, unknown>;
  if (manifest.format !== PROJECT_ARCHIVE_MANIFEST.format || manifest.archiveVersion !== 1) {
    throw new ProjectArchiveError('This project ZIP format or archive version is not supported.');
  }
  if (manifest.project !== PROJECT_PATH) {
    throw new ProjectArchiveError(`The project ZIP manifest must reference ${PROJECT_PATH}.`);
  }
  if (!Array.isArray(manifest.assets)) {
    throw new ProjectArchiveError('The project ZIP manifest assets field must be an array.');
  }
  if (manifest.assets.length > 0) {
    throw new ProjectArchiveError('This version does not yet support embedded assets in project ZIP files.');
  }
  return PROJECT_ARCHIVE_MANIFEST;
}

export function parseProjectArchive(archive: Uint8Array): ProjectDocument {
  if (archive.byteLength > MAX_PROJECT_ARCHIVE_BYTES) {
    throw new ProjectArchiveError('Project ZIP files must be 10 MB or smaller.');
  }

  const seen = new Set<string>();
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(archive, {
      filter: ({ compression, name, originalSize, size }) => {
        if (name.startsWith('assets/')) {
          throw new ProjectArchiveError('Embedded assets are not supported by this project ZIP version.');
        }
        if (!ALLOWED_PATHS.has(name) || name.includes('..') || name.startsWith('/')) {
          throw new ProjectArchiveError(`The project ZIP contains an unsafe or unsupported entry: ${name}.`);
        }
        if (seen.has(name)) {
          throw new ProjectArchiveError(`The project ZIP contains a duplicate ${name} entry.`);
        }
        seen.add(name);
        if (compression !== 0) {
          throw new ProjectArchiveError('Project ZIP entries must use stored compression (method 0).');
        }
        const limit = name === MANIFEST_PATH ? MAX_MANIFEST_BYTES : MAX_PROJECT_ARCHIVE_ENTRY_BYTES;
        if (size > limit || originalSize > limit) {
          const label = name === PROJECT_PATH ? 'the 10 MB project limit' : 'the 64 KB manifest limit';
          throw new ProjectArchiveError(`${name} expands beyond ${label}.`);
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof ProjectArchiveError) throw error;
    throw new ProjectArchiveError('This file is not a valid project ZIP archive.');
  }

  if (seen.size !== 2 || !Object.hasOwn(files, MANIFEST_PATH) || !Object.hasOwn(files, PROJECT_PATH)) {
    throw new ProjectArchiveError(`Project ZIP files must contain ${MANIFEST_PATH} and ${PROJECT_PATH}.`);
  }
  const manifestBytes = files[MANIFEST_PATH];
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) {
    throw new ProjectArchiveError(`${MANIFEST_PATH} expands beyond the 64 KB manifest limit.`);
  }
  const projectBytes = files[PROJECT_PATH];
  if (projectBytes.byteLength > MAX_PROJECT_ARCHIVE_ENTRY_BYTES) {
    throw new ProjectArchiveError(`${PROJECT_PATH} expands beyond the 10 MB project limit.`);
  }
  parseManifest(manifestBytes);
  try {
    return parseProjectFileText(strFromU8(projectBytes));
  } catch (error) {
    if (error instanceof ProjectFileError) throw error;
    throw new ProjectArchiveError('The project data inside this ZIP could not be opened.');
  }
}
