import type { ExportFormat } from './ExportDialogView';
import { FeatureHelp } from './FeatureHelp';
import { SimpleSelect } from '@/components/ui/select';
import { PropertyRow } from './PropertyControls';

type BasemapMode = 'hybrid' | 'vector';
const HYBRID = { value: 'hybrid', label: 'Hybrid (original map appearance)' } as const;
const VECTOR = { value: 'vector', label: 'True vector artwork (reflowed labels)' } as const;
const WITH_VECTOR = [HYBRID, VECTOR] as const;
const WITHOUT_VECTOR = [HYBRID, { ...VECTOR, disabled: true }] as const;

export function ExportBasemapMode(props: Readonly<{
  format: ExportFormat;
  mode: 'hybrid' | 'vector';
  busy: boolean;
  available: boolean;
  onChange: (mode: 'hybrid' | 'vector') => void;
}>) {
  if (props.format !== 'svg' && props.format !== 'pdf') return null;
  return <PropertyRow label="Basemap">
    <div className="export-field-with-help">
      <SimpleSelect<BasemapMode> id="export-basemap-mode" label="Basemap rendering" value={props.mode} disabled={props.busy}
        options={props.available ? WITH_VECTOR : WITHOUT_VECTOR} onValueChange={props.onChange} />
      <FeatureHelp label="Basemap rendering help">
        <p>Hybrid preserves the original map appearance.</p>
        <p>True vector reflows labels in embedded Noto Sans Latin. Sprites become generic named markers or reference shields; halos become sharp outlines. Positions and typography differ from the live map.</p>
        <p>Raster, patterns, terrain, 3D and unsupported glyphs block vector export. Nothing automatically falls back to an image.</p>
      </FeatureHelp>
    </div>
  </PropertyRow>;
}
