const encoder = new TextEncoder();

export type PdfChunk = string | Uint8Array;
export type PdfObject = readonly PdfChunk[];

export function pdfString(value: string): string {
  if ([...value].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 && code <= 126;
  })) {
    return `(${value.replaceAll(/([\\()])/g, String.raw`\$1`)})`;
  }
  let hexadecimal = 'FEFF';
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0xFF_FF) {
      hexadecimal += codePoint.toString(16).padStart(4, '0').toUpperCase();
      continue;
    }
    const adjusted = codePoint - 0x01_00_00;
    const high = 0xD8_00 + (adjusted >> 10);
    const low = 0xDC_00 + (adjusted & 0x03_FF);
    hexadecimal += high.toString(16).padStart(4, '0').toUpperCase();
    hexadecimal += low.toString(16).padStart(4, '0').toUpperCase();
  }
  return `<${hexadecimal}>`;
}

export function asciiBytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function streamObject(dictionary: string, bytes: Uint8Array): PdfObject {
  return [
    `<< ${dictionary}${dictionary ? ' ' : ''}/Length ${bytes.length} >>\nstream\n`,
    bytes,
    '\nendstream',
  ];
}

export function buildPdf(objects: readonly PdfObject[], infoReference: number): Uint8Array {
  const chunks: Uint8Array[] = [
    asciiBytes('%PDF-1.7\n'),
    Uint8Array.from([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]),
  ];
  const offsets = [0];
  let length = chunks.reduce((total, chunk) => total + chunk.length, 0);

  for (const [index, object] of objects.entries()) {
    offsets.push(length);
    const objectChunks = [asciiBytes(`${index + 1} 0 obj\n`), ...object.map((chunk) => (
      typeof chunk === 'string' ? asciiBytes(chunk) : chunk
    )), asciiBytes('\nendobj\n')];
    chunks.push(...objectChunks);
    length += objectChunks.reduce((total, chunk) => total + chunk.length, 0);
  }

  const xrefOffset = length;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoReference} 0 R >>\n`,
    `startxref\n${xrefOffset}\n%%EOF\n`,
  ].join('');
  chunks.push(asciiBytes(xref));
  return concatenate(chunks);
}
