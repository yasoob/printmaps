import { strToU8, zipSync } from 'fflate';
import { createInitialProjectDocument } from '../../src/domain/project';
import {
  createProjectArchive,
  MAX_PROJECT_ARCHIVE_BYTES,
  parseProjectArchive,
} from '../../src/domain/projectArchive';

// Constructed from local components: fflate encodes DOS timestamps in local time,
// so a UTC instant would fall below the 1980 floor in timezones behind UTC.
const FIXED_ARCHIVE_MTIME = new Date(1980, 0, 2, 0, 0, 0, 0);

const fixedZip = (entries: Record<string, string | Uint8Array>) => zipSync(
  Object.fromEntries(Object.entries(entries).map(([name, value]) => [
    name,
    strToU8(typeof value === 'string' ? value : new TextDecoder().decode(value)),
  ])),
  { level: 0, mtime: FIXED_ARCHIVE_MTIME },
);

const manifest = JSON.stringify({
  format: 'print-map-studio-project',
  archiveVersion: 1,
  project: 'project.printmap.json',
  assets: [],
});
const canonicalProjectText = JSON.stringify(createInitialProjectDocument());
const unsupportedArchives = [
  ['an asset entry', fixedZip({
    'manifest.json': manifest,
    'project.printmap.json': canonicalProjectText,
    'assets/marker.png': 'not-an-image',
  }), 'Embedded assets are not supported'],
  ['a traversal path', fixedZip({
    'manifest.json': manifest,
    'project.printmap.json': canonicalProjectText,
    '../outside.txt': 'unsafe',
  }), 'unsafe or unsupported entry'],
  ['a manifest with assets', fixedZip({
    'manifest.json': JSON.stringify({
      format: 'print-map-studio-project',
      archiveVersion: 1,
      project: 'project.printmap.json',
      assets: ['assets/marker.png'],
    }),
    'project.printmap.json': canonicalProjectText,
  }), 'does not yet support embedded assets'],
  ['a missing manifest', fixedZip({
    'project.printmap.json': canonicalProjectText,
  }), 'must contain manifest.json and project.printmap.json'],
] as const;

function falsifyCentralDirectoryOriginalSize(archive: Uint8Array, originalSize: number) {
  const forged = new Uint8Array(archive);
  const signature = [0x50, 0x4B, 0x01, 0x02];
  const centralDirectoryOffset = forged.findIndex((_byte, index) => (
    signature.every((value, signatureIndex) => forged[index + signatureIndex] === value)
  ));
  if (centralDirectoryOffset === -1) throw new Error('Expected a ZIP central directory.');
  new DataView(forged.buffer).setUint32(centralDirectoryOffset + 24, originalSize, true);
  return forged;
}

describe('portable project ZIP archives', () => {
  it('creates deterministic bytes that round-trip the complete canonical document', () => {
    const source = createInitialProjectDocument();
    source.title = 'Round trip 東京';
    source.style.visibility.roads = false;

    const first = createProjectArchive(source);
    const second = createProjectArchive(source);
    const parsed = parseProjectArchive(first);

    expect(first).toEqual(second);
    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(parsed.layers[0]).not.toBe(source.layers[0]);
  });

  it('rejects archives above the portable project limit before opening project state', () => {
    expect(() => parseProjectArchive(new Uint8Array(MAX_PROJECT_ARCHIVE_BYTES + 1)))
      .toThrow('Project ZIP files must be 10 MB or smaller');
  });

  it('checks stored entry size when central-directory original size is false', () => {
    const oversizedManifest = zipSync({
      'manifest.json': strToU8(' '.repeat(70 * 1024)),
      'project.printmap.json': strToU8(canonicalProjectText),
    }, { level: 0, mtime: new Date(1980, 0, 1) });
    const forged = falsifyCentralDirectoryOriginalSize(oversizedManifest, 1);

    expect(() => parseProjectArchive(forged)).toThrow('manifest.json expands beyond the 64 KB manifest limit');
  });

  it('rejects compressed entries before forged expansion metadata can be trusted', () => {
    const paddedManifest = JSON.stringify({
      format: 'print-map-studio-project',
      archiveVersion: 1,
      project: 'project.printmap.json',
      assets: [],
      padding: 'x'.repeat(1024 * 1024),
    });
    const compressed = zipSync({
      'manifest.json': strToU8(paddedManifest),
      'project.printmap.json': strToU8(canonicalProjectText),
    }, { level: 9, mtime: new Date(1980, 0, 1) });
    const forged = falsifyCentralDirectoryOriginalSize(compressed, 1);

    expect(() => parseProjectArchive(forged)).toThrow('Project ZIP entries must use stored compression');
  });

  it.each(unsupportedArchives)('rejects %s', (_label, archive, message) => {
    expect(() => parseProjectArchive(archive)).toThrow(message);
  });
});
