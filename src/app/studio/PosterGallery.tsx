import { POSTER_STARTERS, POSTER_TEMPLATES, type PosterStarter, type PosterTemplate } from '../../domain/studioTemplates';
import { MAP_STYLE_PRESETS } from '../../domain/mapStylePresets';
import { FeatureHelp } from '../components/FeatureHelp';

export function PosterGallery({ cameraLocked, onApply }: {
  cameraLocked: boolean;
  onApply: (id: PosterTemplate['id'], starter?: PosterStarter) => void;
}) {
  return <div className="studio-poster-gallery">
    <div className="feature-help-row"><h4>Style your current place</h4><FeatureHelp label="Poster templates help">Apply a finished design to your current place. Your routes, points, shapes, and photos are kept.</FeatureHelp></div>
    <div className="studio-template-grid">
      {POSTER_TEMPLATES.map((template) => <button type="button" className="studio-template-card" key={template.id} onClick={() => onApply(template.id)}>
        <span className="studio-template-art" style={{ background: template.background, color: template.ink }}>
          <img src={MAP_STYLE_PRESETS.find(({ id }) => id === template.preset)?.thumbnailUrl} alt="" loading="lazy" />
          <strong>{template.name}</strong><small>YOUR PLACE / YOUR STORY</small>
        </span>
        <span>{template.name}</span><small>{template.description}</small>
      </button>)}
    </div>
    <div className="feature-help-row"><h4>Start somewhere new</h4><FeatureHelp label="Starter locations help">Starters move the camera to a new location. They do not remove your existing content.</FeatureHelp></div>
    {cameraLocked && <p role="status">Unlock the map area to use a starter location.</p>}
    <div className="studio-starter-grid">{POSTER_STARTERS.map((starter) => <button type="button" key={starter.id} disabled={cameraLocked} onClick={() => onApply(starter.templateId, starter)}><strong>{starter.name}</strong><small>{starter.subtitle}</small></button>)}</div>
  </div>;
}
