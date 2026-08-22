import type { ProjectDocument } from '../../domain/project';

export function downloadProjectDocument(document: ProjectDocument) {
  const filenameId = document.id.replaceAll(/[^a-z0-9._-]+/gi, '-').replaceAll(/^[-.]+|[-.]+$/g, '') || 'project';
  const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${filenameId}.printmap.json`;
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
