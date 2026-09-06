import { createPortableProjectFile, downloadProjectDocument } from '../../src/app/components/projectDownload';
import { MAX_PROJECT_FILE_BYTES } from '../../src/domain/projectFile';
import { createInitialProjectDocument } from '../../src/domain/project';
import { byteBudgetProject } from '../fixtures/portableBudget';
import { ProjectSizeError } from '../../src/domain/projectSerialization';

describe('portable project JSON download', () => {
  it('rejects a backup that the project parser cannot reopen', () => {
    const document = createInitialProjectDocument();
    document.layers[0].name = 'x'.repeat(201);
    expect(() => createPortableProjectFile(document)).toThrow('200 characters or fewer');
  });

  it('refuses a JSON artifact that the 10 MiB Open guard cannot restore', () => {
    const document = byteBudgetProject(MAX_PROJECT_FILE_BYTES + 1);
    expect(() => downloadProjectDocument(document)).toThrow(ProjectSizeError);
  });
});
