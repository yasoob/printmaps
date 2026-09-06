import type { ProjectMutationResult } from '../../domain/projectMutation';

export type PoiSpreadsheetController = {
  documentEpoch: number;
  // False defers activation; only explicit discard may invoke onApproved.
  requestToolChange: (tool: string, onApproved?: () => ProjectMutationResult) => boolean;
  retire: () => void;
};

export type PoiSpreadsheetRegistration = {
  register: (controller: PoiSpreadsheetController) => () => void;
  reportWork: (controller: PoiSpreadsheetController, hasWork: boolean) => void;
};
