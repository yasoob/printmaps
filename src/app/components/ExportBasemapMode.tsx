import { StudioDialogSection } from '@/components/ui/studio-dialog';
import type { ExportFormat } from './ExportDialogView';

export function ExportBasemapMode(props: Readonly<{
  format: ExportFormat;
  mode: 'hybrid' | 'vector';
  busy: boolean;
  available: boolean;
  onChange: (mode: 'hybrid' | 'vector') => void;
}>) {
  if (props.format !== 'svg' && props.format !== 'pdf') return null;
  return <StudioDialogSection>
    <label htmlFor="export-basemap-mode">Basemap rendering</label>
    <select id="export-basemap-mode" value={props.mode} disabled={props.busy} onChange={(event) => props.onChange(event.target.value === 'vector' ? 'vector' : 'hybrid')}>
      <option value="hybrid">Hybrid (original map appearance)</option>
      <option value="vector" disabled={!props.available}>True vector artwork (reflowed labels)</option>
    </select>
    {props.mode === 'vector' && <p>Vector placement mode: labels are reflowed in embedded Noto Sans Latin; sprites become generic named vector markers or reference shields, and halos become sharp outlines. Label positions and typography differ from the live map. Raster, patterns, terrain, 3D and unsupported glyphs block export; nothing automatically falls back to an image. Choose Hybrid to preserve the original appearance.</p>}
  </StudioDialogSection>;
}
