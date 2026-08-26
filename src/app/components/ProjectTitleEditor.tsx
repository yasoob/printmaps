import { Pencil } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

type ProjectTitleEditorProps = {
  buttonRef?: RefObject<HTMLButtonElement | null>;
  onChange: (title: string) => void;
  title: string;
};

export function ProjectTitleEditor({ buttonRef, onChange, title }: ProjectTitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const finish = (shouldSave: boolean) => {
    if (shouldSave) onChange(draft);
    setEditing(false);
    queueMicrotask(() => buttonRef?.current?.focus());
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="project-title-input"
        aria-label="Project title"
        maxLength={120}
        value={draft}
        onBlur={() => finish(true)}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); finish(true); }
          else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
        }}
      />
    );
  }

  return (
    <button ref={buttonRef} className="project-title" type="button" title="Rename project" onClick={() => { setDraft(title); setEditing(true); }}>
      <span>{title}</span><Pencil className="project-title-pencil" aria-hidden="true" size={13} strokeWidth={1.8} />
    </button>
  );
}
