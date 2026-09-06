import type { ProjectDocument } from '../../domain/project';
import { createProjectArchive } from '../../domain/projectArchive';
import { parseProjectFileText } from '../../domain/projectFile';
import { portableProjectText } from '../../domain/projectSerialization';
import { downloadBlob } from '../../lib/downloadBlob';

function safeFilenameId(document: ProjectDocument) {
  return document.id.replaceAll(/[^a-z0-9._-]+/gi, '-').replaceAll(/^[-.]+|[-.]+$/g, '') || 'project';
}

export function createPortableProjectFile(document: ProjectDocument) {
  const text = portableProjectText(document);
  const file = new File(
    [text],
    `${safeFilenameId(document)}.printmap.json`,
    { type: 'application/json' },
  );
  parseProjectFileText(text);
  return file;
}

export function downloadProjectDocument(document: ProjectDocument) {
  const file = createPortableProjectFile(document);
  downloadBlob(file, file.name);
}

export function downloadProjectArchive(document: ProjectDocument) {
  const blob = new Blob([createProjectArchive(document)], { type: 'application/zip' });
  downloadBlob(blob, `${safeFilenameId(document)}.printmap.zip`);
}
