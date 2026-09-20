import { PROJECT_SCHEMA_VERSION } from './project';
import { createDefaultMapStyleCustomization } from './mapStyleCustomization';
import { createDefaultStudioSettings } from './studio';
import { studioObject } from './studioValidation';

export function migrateProjectRoot(root: Record<string, unknown>): Record<string, unknown> {
  if (root.schemaVersion !== 24 && root.schemaVersion !== 25) return root;
  return {
    ...root,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    ...(root.schemaVersion === 24 && { style: {
      ...studioObject(root.style, 'Project style'),
      customization: createDefaultMapStyleCustomization(),
    } }),
    studio: root.studio === undefined ? createDefaultStudioSettings() : root.studio,
  };
}
