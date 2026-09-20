import type { ExportFormat } from './ExportDialogView';
import { FeatureHelp } from './FeatureHelp';

export function ExportBasemapMode(props: Readonly<{
  format: ExportFormat;
  mode: 'hybrid' | 'vector';
  busy: boolean;
  available: boolean;
  onChange: (mode: 'hybrid' | 'vector') => void;
}>) {
  if (props.format !== 'svg' && props.format !== 'pdf') return null;
  return <div className="export-basemap-mode">
    <div className="feature-help-row"><label htmlFor="export-basemap-mode">Basemap rendering</label><FeatureHelp label="Basemap rendering help">
      <p>Hybrid preserves the original map appearance.</p>
      <p>True vector reflows labels in embedded Noto Sans Latin. Sprites become generic named markers or reference shields; halos become sharp outlines. Positions and typography differ from the live map.</p>
      <p>Raster, patterns, terrain, 3D and unsupported glyphs block vector export. Nothing automatically falls back to an image.</p>
    </FeatureHelp></div>
    <select id="export-basemap-mode" value={props.mode} disabled={props.busy} onChange={(event) => props.onChange(event.target.value === 'vector' ? 'vector' : 'hybrid')}>
      <option value="hybrid">Hybrid (original map appearance)</option>
      <option value="vector" disabled={!props.available}>True vector artwork (reflowed labels)</option>
    </select>
  </div>;
}
