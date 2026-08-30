function sanitizeBaseFilename(filename: string): string {
  return filename
    .replace(/(?:\.layered\.svg|\.svg|\.png|\.pdf)$/i, '')
    .replaceAll(/[^a-z0-9._-]+/gi, '-')
    .replaceAll(/^[-.]+|[-.]+$/g, '') || 'map';
}

export function startPrintPdfDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeBaseFilename(filename)}.pdf`;
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
