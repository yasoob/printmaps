import { ChevronRight } from 'lucide-react';
import { Activity, useId, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { trackEditorAction } from '../../analytics/editorAnalytics';

export function PropertySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="property-section"><h3>{title}</h3>{children}</section>;
}

type InspectorAccordionProps = {
  children: React.ReactNode;
  isDefaultExpanded: boolean;
  storageKey: string;
  summary: string;
  title: string;
};

function readDisclosurePreference(storageKey: string, isDefaultExpanded: boolean) {
  try {
    const stored = globalThis.localStorage?.getItem(storageKey);
    if (stored === 'open') return true;
    if (stored === 'closed') return false;
  } catch {
    // The inspector remains usable when storage is blocked or unavailable.
  }
  return isDefaultExpanded;
}

/**
 * Persisted inspector disclosure on shadcn Collapsible. The trigger keeps `aria-expanded`/`aria-controls`;
 * the collapsed summary describes it; content mounts on first open and stays in an Activity boundary.
 */
export function InspectorAccordion({ children, isDefaultExpanded, storageKey, summary, title }: InspectorAccordionProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const summaryId = `${baseId}-summary`;
  const [isExpanded, setIsExpanded] = useState(() => readDisclosurePreference(storageKey, isDefaultExpanded));
  const [hasExpanded, setHasExpanded] = useState(isExpanded);
  const changeExpanded = (isNextExpanded: boolean) => {
    trackEditorAction('inspectorSectionToggled', { enabled: isNextExpanded });
    setIsExpanded(isNextExpanded);
    if (isNextExpanded) setHasExpanded(true);
    try {
      globalThis.localStorage?.setItem(storageKey, isNextExpanded ? 'open' : 'closed');
    } catch {
      // Disclosure state is intentionally noncritical local UI preference.
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={changeExpanded} render={<section className="inspector-accordion" />}>
      <h3>
        <CollapsibleTrigger aria-describedby={isExpanded ? undefined : summaryId} aria-labelledby={labelId}>
          <ChevronRight aria-hidden="true" className="inspector-chevron" size={16} strokeWidth={1.75} />
          <span id={labelId} className="inspector-section-label">{title}</span>
          {!isExpanded && <span id={summaryId} className="inspector-section-summary">{summary}</span>}
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent keepMounted className="inspector-accordion-content">
        {hasExpanded && <Activity mode={isExpanded ? 'visible' : 'hidden'}>{children}</Activity>}
      </CollapsibleContent>
    </Collapsible>
  );
}

type PropertyRowProps = {
  label: string;
  children: React.ReactNode;
  /**
  `stacked` places the label above a full-width control, for multi-line text.
  */
  layout?: 'inline' | 'stacked';
};

export function PropertyRow({ label, children, layout = 'inline' }: PropertyRowProps) {
  return (
    <div className="property-row" data-layout={layout}>
      <span aria-hidden="true" title={label}>{label}</span>
      <div className="property-control">{children}</div>
    </div>
  );
}

/**
Small group heading inside a property section, optionally with a trailing action.
*/
export function PropertySubheading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="property-subheading">
      <h4>{children}</h4>
      {action}
    </div>
  );
}
