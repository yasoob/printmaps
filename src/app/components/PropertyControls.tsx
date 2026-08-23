import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';

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

export function InspectorAccordion({ children, isDefaultExpanded, storageKey, summary, title }: InspectorAccordionProps) {
  const contentId = useId();
  const labelId = `${contentId}-label`;
  const summaryId = `${contentId}-summary`;
  const [isExpanded, setIsExpanded] = useState(() => readDisclosurePreference(storageKey, isDefaultExpanded));
  const toggle = () => {
    const isNextExpanded = !isExpanded;
    setIsExpanded(isNextExpanded);
    try {
      globalThis.localStorage?.setItem(storageKey, isNextExpanded ? 'open' : 'closed');
    } catch {
      // Disclosure state is intentionally noncritical local UI preference.
    }
  };

  return (
    <section className="inspector-accordion">
      <h3>
        <button type="button" aria-controls={contentId} aria-describedby={summaryId} aria-expanded={isExpanded} aria-labelledby={labelId} onClick={toggle}>
          <ChevronRight aria-hidden="true" className="inspector-chevron" size={16} />
          <span id={labelId} className="inspector-section-label">{title}</span>
          <span id={summaryId} className="inspector-section-summary">{summary}</span>
        </button>
      </h3>
      <div id={contentId} className="inspector-accordion-content" hidden={!isExpanded}>{children}</div>
    </section>
  );
}

export function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="property-row"><span aria-hidden="true">{label}</span><div className="property-control">{children}</div></div>;
}
