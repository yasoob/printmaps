import type { ProjectDocument } from '../../domain/project';
import { createProjectArchive } from '../../domain/projectArchive';
import { MAX_PROJECT_FILE_BYTES } from '../../domain/projectFile';

function safeFilenameId(document: ProjectDocument) {
  return document.id.replaceAll(/[^a-z0-9._-]+/gi, '-').replaceAll(/^[-.]+|[-.]+$/g, '') || 'project';
}

export function createPortableProjectFile(document: ProjectDocument) {
  const file = new File(
    [`${JSON.stringify(document, null, 2)}\n`],
    `${safeFilenameId(document)}.printmap.json`,
    { type: 'application/json' },
  );
  if (file.size > MAX_PROJECT_FILE_BYTES) {
    throw new Error('The portable project JSON must be 10 MB or smaller. Remove project content before saving.');
  }
  return file;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const link = window.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function downloadProjectDocument(document: ProjectDocument) {
  const file = createPortableProjectFile(document);
  downloadBlob(file, file.name);
}

export function downloadProjectArchive(document: ProjectDocument) {
  const blob = new Blob([createProjectArchive(document)], { type: 'application/zip' });
  downloadBlob(blob, `${safeFilenameId(document)}.printmap.zip`);
}
