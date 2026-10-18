import { Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { IconTooltip } from './IconTooltip';

type ProjectTitleEditorProps = {
  buttonRef?: RefObject<HTMLButtonElement | null>;
  onChange: (title: string) => ProjectMutationResult;
  title: string;
};

export function ProjectTitleEditor({ buttonRef, onChange, title }: ProjectTitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const finish = (shouldSave: boolean) => {
    if (shouldSave) {
      const result = onChange(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
    }
    setError(null);
    setEditing(false);
    queueMicrotask(() => buttonRef?.current?.focus());
  };

  if (editing) {
    return (
      <span className="project-title-edit">
      <Input
        ref={inputRef}
        className="w-[min(14rem,28vw)] max-w-full border-studio-accent px-2 font-semibold text-ink-strong hover:border-studio-accent"
        aria-label="Project title"
        aria-invalid={!!error}
        maxLength={120}
        value={draft}
        onBlur={() => finish(true)}
        onChange={(event) => { setDraft(event.currentTarget.value); setError(null); }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); finish(true); }
          else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
        }}
      />
      {error && <span className="project-title-error" role="alert">{error}</span>}
      </span>
    );
  }

  return (
    <IconTooltip label="Rename project">
      <button ref={buttonRef} className="project-title" type="button" onClick={() => { setDraft(title); setEditing(true); }}>
        <span>{title}</span><Pencil className="project-title-pencil" aria-hidden="true" size={13} strokeWidth={1.8} />
      </button>
    </IconTooltip>
  );
}
