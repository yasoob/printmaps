import { downloadProjectDocument } from '../../src/app/components/projectDownload';
import { MAX_PROJECT_FILE_BYTES } from '../../src/domain/projectFile';
import { createInitialProjectDocument } from '../../src/domain/project';

describe('portable project JSON download', () => {
  it('refuses a JSON artifact that the 10 MiB Open guard cannot restore', () => {
    const document = createInitialProjectDocument();
    const assetId = `sha256-${'a'.repeat(64)}`;
    document.assets[assetId] = {
      id: assetId,
      mimeType: 'image/png',
      width: 100,
      height: 100,
      dataUri: `data:image/png;base64,${'A'.repeat(MAX_PROJECT_FILE_BYTES)}`,
    };

    expect(() => downloadProjectDocument(document)).toThrow('10 MB or smaller');
  });
});
