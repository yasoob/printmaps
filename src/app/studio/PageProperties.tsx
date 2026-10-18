import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PagePreset, PageSettings } from '../../domain/project';
import { PAGE_PRESET_DEFINITIONS } from '../../domain/pagePresets';
import { useProject, useProjectActions, useProjectStoreApi } from '../projectStoreContext';
import { InspectorAccordion, PropertyRow, PropertySubheading } from '../components/PropertyControls';
import { SegmentedControl } from '../../components/ui/segmented-control';
import { ValidatedNumberField } from '../components/ValidatedNumberField';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { useSettingActions } from '../hooks/useSettingActions';
import { StudioColor } from './StudioFields';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { editablePoster } from './posterEditing';
import { useStableEvent } from '../hooks/useStableEvent';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const PAGE_KEYS = ['backgroundColor', ...SIDES] as const;
const MARGIN_ORDER = ['top', 'bottom', 'left', 'right'] as const;
const ORIENTATIONS = [{ value: 'landscape', label: 'Landscape' }, { value: 'portrait', label: 'Portrait' }] as const;
const SIDE_LABELS = { top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' } as const;
const SIDE_PREFIXES = { top: 'T', right: 'R', bottom: 'B', left: 'L' } as const;

// Margins share the W/H prefix grammar so the page section reads as one compact grid.
const MarginField = memo(function MarginField({ label, prefix, value, epoch, onChange }: {
  label: string; prefix: string; value: number; epoch: number; onChange: (value: number) => ProjectMutationResult;
}) {
  return <ValidatedNumberField label={label} prefix={prefix} value={value} minimum={0} maximum={100} step={0.5} unit="mm" resetKey={epoch} onCommit={onChange} />;
});

const PageDimensions = memo(function PageDimensions({ page, epoch }: { page: PageSettings; epoch: number }) {
  const actions = useProjectActions();
  const feedback = useMutationFeedback(page);
  const changeOrientation = useStableEvent((orientation: PageSettings['orientation']) => feedback.report(actions.setPageOrientation(orientation)));
  return <>
    <PropertyRow label="Size"><select aria-label="Page preset" value={page.preset} onChange={(event) => feedback.report(actions.setPagePreset(event.target.value as PagePreset))}>
      {PAGE_PRESET_DEFINITIONS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}<option value="Custom">Custom</option>
    </select></PropertyRow>
    <div className="inspector-field-grid" role="group" aria-label="Page dimensions">
      <ValidatedNumberField label="Page width" prefix="W" value={page.widthMm} minimum={0.1} step={0.1} unit="mm" resetKey={`${epoch}:${page.preset}`} onCommit={(value) => actions.setPageDimension('widthMm', value)} />
      <ValidatedNumberField label="Page height" prefix="H" value={page.heightMm} minimum={0.1} step={0.1} unit="mm" resetKey={`${epoch}:${page.preset}`} onCommit={(value) => actions.setPageDimension('heightMm', value)} />
    </div>
    <PropertyRow label="Orientation"><SegmentedControl label="Page orientation" value={page.orientation} options={ORIENTATIONS}
      onValueChange={changeOrientation} /></PropertyRow>
    {feedback.error && <p role="alert" className="coordinate-validation">{feedback.error}</p>}
  </>;
});

const PageAppearance = memo(function PageAppearance({ epoch }: { epoch: number }) {
  const store = useProjectStoreApi();
  const { setStudioSection } = useProjectActions();
  const values = useProject(useShallow((state) => {
    const poster = state.document.studio.poster;
    return {
      backgroundColor: poster.backgroundColor,
      top: poster.enabled ? poster.marginsMm.top : 0,
      right: poster.enabled ? poster.marginsMm.right : 0,
      bottom: poster.enabled ? poster.marginsMm.bottom : 0,
      left: poster.enabled ? poster.marginsMm.left : 0,
    };
  }));
  const feedback = useMutationFeedback(values);
  const commit = useStableEvent((value: typeof values) => {
    const poster = editablePoster(store.getState().document.studio.poster);
    return feedback.report(setStudioSection('poster', {
      ...poster, enabled: true, backgroundColor: value.backgroundColor,
      marginsMm: { top: value.top, right: value.right, bottom: value.bottom, left: value.left },
    }));
  });
  const change = useSettingActions(values, commit, PAGE_KEYS);
  return <>
    <StudioColor label="Paper color" value={values.backgroundColor} onChange={change.backgroundColor} />
    <PropertySubheading>Margins</PropertySubheading>
    <div className="inspector-field-grid" role="group" aria-label="Margins">
      {MARGIN_ORDER.map((side) => <MarginField key={side} label={`${SIDE_LABELS[side]} margin`} prefix={SIDE_PREFIXES[side]}
        value={values[side]} epoch={epoch} onChange={change[side]} />)}
    </div>
    {feedback.error && <p role="alert" className="coordinate-validation">{feedback.error}</p>}
  </>;
});

export const PageProperties = memo(function PageProperties({ isAppearanceDisabled = false }: { isAppearanceDisabled?: boolean }) {
  const page = useProject((state) => state.document.page);
  const epoch = useProject((state) => state.documentEpoch);
  return <InspectorAccordion title="Page" storageKey="print-map-studio:inspector:project:page" isDefaultExpanded
    summary={`${page.preset} ${page.orientation} · ${page.widthMm} × ${page.heightMm} mm`}>
    <PageDimensions page={page} epoch={epoch} />
    <fieldset className="studio-composition-boundary" disabled={isAppearanceDisabled}>
      <PageAppearance epoch={epoch} />
    </fieldset>
  </InspectorAccordion>;
});
