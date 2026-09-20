import { memo, useCallback, useMemo } from 'react';
import type { PagePreset, PageSettings } from '../../domain/project';
import { PAGE_PRESET_DEFINITIONS } from '../../domain/pagePresets';
import type { PosterSettings } from '../../domain/studio';
import { useProject, useProjectActions } from '../projectStoreContext';
import { InspectorAccordion, PropertyRow } from '../components/PropertyControls';
import { ValidatedNumberField } from '../components/ValidatedNumberField';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { useSettingActions } from '../hooks/useSettingActions';
import { StudioColor, StudioNumber } from './StudioFields';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { editablePoster } from './posterEditing';
import { useStableEvent } from '../hooks/useStableEvent';

const PAGE_KEYS = ['backgroundColor', 'marginsMm'] as const;
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

const PageDimensions = memo(function PageDimensions({ page, epoch }: { page: PageSettings; epoch: number }) {
  const actions = useProjectActions();
  const feedback = useMutationFeedback(page);
  return <>
    <PropertyRow label="Size"><select aria-label="Page preset" value={page.preset} onChange={(event) => feedback.report(actions.setPagePreset(event.target.value as PagePreset))}>
      {PAGE_PRESET_DEFINITIONS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}<option value="Custom">Custom</option>
    </select></PropertyRow>
    <div className="paired-fields">
      <ValidatedNumberField label="Page width" prefix="W" value={page.widthMm} minimum={0.1} step={0.1} unit="mm" resetKey={`${epoch}:${page.preset}`} onCommit={(value) => actions.setPageDimension('widthMm', value)} />
      <ValidatedNumberField label="Page height" prefix="H" value={page.heightMm} minimum={0.1} step={0.1} unit="mm" resetKey={`${epoch}:${page.preset}`} onCommit={(value) => actions.setPageDimension('heightMm', value)} />
    </div>
    <PropertyRow label="Orientation"><div className="segmented">
      {(['landscape', 'portrait'] as const).map((orientation) => <button key={orientation} className={page.orientation === orientation ? 'is-active' : undefined}
        type="button" aria-pressed={page.orientation === orientation} onClick={() => feedback.report(actions.setPageOrientation(orientation))}>
        {orientation === 'landscape' ? 'Landscape' : 'Portrait'}
      </button>)}
    </div></PropertyRow>
    {feedback.error && <p role="alert" className="coordinate-validation">{feedback.error}</p>}
  </>;
});

const PageAppearance = memo(function PageAppearance({ poster, epoch, onChange }: {
  poster: PosterSettings; epoch: number; onChange: (value: PosterSettings) => ProjectMutationResult;
}) {
  const feedback = useMutationFeedback(poster);
  const commit = useStableEvent((value: PosterSettings) => feedback.report(onChange({ ...value, enabled: true })));
  const change = useSettingActions(poster, commit, PAGE_KEYS);
  const margins = useSettingActions(poster.marginsMm, change.marginsMm, SIDES);
  return <>
    <StudioColor label="Paper color" value={poster.backgroundColor} onChange={change.backgroundColor} />
    <fieldset className="inspector-field-group"><legend>Margins</legend>
      {SIDES.map((side) => <StudioNumber key={side} label={`${side.charAt(0).toUpperCase() + side.slice(1)} margin`}
        value={poster.marginsMm[side]} epoch={epoch} onChange={margins[side]} />)}
    </fieldset>
    {feedback.error && <p role="alert" className="coordinate-validation">{feedback.error}</p>}
  </>;
});

export const PageProperties = memo(function PageProperties() {
  const page = useProject((state) => state.document.page);
  const poster = useProject((state) => state.document.studio.poster);
  const effectivePoster = useMemo(() => editablePoster(poster), [poster]);
  const epoch = useProject((state) => state.documentEpoch);
  const { setStudioSection } = useProjectActions();
  const change = useCallback((value: PosterSettings) => setStudioSection('poster', value), [setStudioSection]);
  return <InspectorAccordion title="Page" storageKey="print-map-studio:inspector:project:page" isDefaultExpanded
    summary={`${page.preset} ${page.orientation} · ${page.widthMm} × ${page.heightMm} mm`}>
    <PageDimensions page={page} epoch={epoch} />
    <PageAppearance poster={effectivePoster} epoch={epoch} onChange={change} />
  </InspectorAccordion>;
});
