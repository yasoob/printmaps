import type { ExportFormat } from './ExportDialogView';
import { FeatureHelp } from './FeatureHelp';
import { PropertyRow } from './PropertyControls';

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
      <select id="export-basemap-mode" aria-label="Basemap rendering" value={props.mode} disabled={props.busy} onChange={(event) => props.onChange(event.target.value === 'vector' ? 'vector' : 'hybrid')}>
        <option value="hybrid">Hybrid (original map appearance)</option>
        <option value="vector" disabled={!props.available}>True vector artwork (reflowed labels)</option>
      </select>
      <FeatureHelp label="Basemap rendering help">
        <p>Hybrid preserves the original map appearance.</p>
        <p>True vector reflows labels in embedded Noto Sans Latin. Sprites become generic named markers or reference shields; halos become sharp outlines. Positions and typography differ from the live map.</p>
        <p>Raster, patterns, terrain, 3D and unsupported glyphs block vector export. Nothing automatically falls back to an image.</p>
      </FeatureHelp>
    </div>
  </PropertyRow>;
}
