import { MoveDiagonal2, PenLine } from 'lucide-react';
import type { ShapeEditMode } from '../../map/ShapeVertexEditing';

export type { ShapeEditMode } from '../../map/ShapeVertexEditing';

type ShapeEditingToolbarProps = {
  mode: ShapeEditMode;
  onChange: (mode: ShapeEditMode) => void;
};

export function ShapeEditingToolbar({ mode, onChange }: ShapeEditingToolbarProps) {
  return (
    <div className="shape-editing-toolbar" role="group" aria-label="Area editing">
      <button
        type="button"
        aria-label="Edit area points"
        aria-pressed={mode === 'points'}
        className={mode === 'points' ? 'is-active' : undefined}
        onClick={() => onChange('points')}
      >
        <PenLine aria-hidden="true" size={14} /> Points
      </button>
      <button
        type="button"
        aria-label="Transform area"
        aria-pressed={mode === 'transform'}
        className={mode === 'transform' ? 'is-active' : undefined}
        onClick={() => onChange('transform')}
      >
        <MoveDiagonal2 aria-hidden="true" size={14} /> Transform
      </button>
    </div>
  );
}
