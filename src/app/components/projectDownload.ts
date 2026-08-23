import type { ProjectDocument } from '../../domain/project';
import { createProjectArchive } from '../../domain/projectArchive';

function safeFilenameId(document: ProjectDocument) {
  return document.id.replaceAll(/[^a-z0-9._-]+/gi, '-').replaceAll(/^[-.]+|[-.]+$/g, '') || 'project';
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
  const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], { type: 'application/json' });
  downloadBlob(blob, `${safeFilenameId(document)}.printmap.json`);
}

export function downloadProjectArchive(document: ProjectDocument) {
  const blob = new Blob([createProjectArchive(document)], { type: 'application/zip' });
  downloadBlob(blob, `${safeFilenameId(document)}.printmap.zip`);
}
