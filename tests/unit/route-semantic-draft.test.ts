import { describe, expect, it } from "vitest";
import {
  canonicalDraftPoints,
  commitRouteSemanticPreview,
  createRouteSemanticDraft,
  editRouteSemanticDraft,
  editableSemanticPoints,
  moveDraftPoint,
  previewRouteSemanticDraft,
  removeDraftPoint,
  replaceDraftPoint,
  undoRouteSemanticDraft,
} from "../../src/app/hooks/routeSemanticDraft";

describe("semantic route drafts", () => {
  it("keeps every list operation in one coherent draft-only undo stack", () => {
    let draft = createRouteSemanticDraft([[0, 0], [1, 1], [2, 2]]);
    draft = editRouteSemanticDraft(draft, moveDraftPoint(draft.points, 2, 1));
    draft = editRouteSemanticDraft(draft, removeDraftPoint(draft.points, 0));
    draft = editRouteSemanticDraft(
      draft,
      replaceDraftPoint(draft.points, 0, [3, 3]),
    );

    expect(draft.points).toEqual([[3, 3], [1, 1]]);
    draft = undoRouteSemanticDraft(draft);
    expect(draft.points).toEqual([[2, 2], [1, 1]]);
    draft = undoRouteSemanticDraft(draft);
    expect(draft.points).toEqual([[0, 0], [2, 2], [1, 1]]);
    draft = undoRouteSemanticDraft(draft);
    expect(draft.points).toEqual([[0, 0], [1, 1], [2, 2]]);
    expect(draft.history).toHaveLength(0);
  });

  it("records a pointer preview as one edit instead of every drag frame", () => {
    const initial = createRouteSemanticDraft([[0, 0], [1, 1]]);
    let draft = previewRouteSemanticDraft(initial, [[0, 0], [2, 2]]);
    draft = previewRouteSemanticDraft(draft, [[0, 0], [3, 3]]);
    draft = commitRouteSemanticPreview(draft, initial.points);

    expect(draft.history).toEqual([[[0, 0], [1, 1]]]);
    expect(undoRouteSemanticDraft(draft).points).toEqual(initial.points);
  });

  it("materializes unique closed-loop rows and restores the canonical return", () => {
    const canonical = [[0, 0], [1, 0], [1, 1], [0, 0]] as const;
    const editable = editableSemanticPoints(canonical, true);

    expect(editable).toEqual([[0, 0], [1, 0], [1, 1]]);
    expect(canonicalDraftPoints(editable, true)).toEqual(canonical);
  });
});
