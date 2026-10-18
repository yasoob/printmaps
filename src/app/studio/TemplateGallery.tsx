import { MapPin } from 'lucide-react';
import { memo } from 'react';
import { POSTER_STARTERS, POSTER_TEMPLATES, type PosterStarter, type PosterTemplate } from '../../domain/studioTemplates';
import { MAP_STYLE_PRESETS } from '../../domain/mapStylePresets';
import './studioComposition.css';

export type TemplateGalleryProps = {
  mode: 'layout' | 'new-project';
  onSelect: (id: PosterTemplate['id'], starter?: PosterStarter) => void;
};

export const TemplateGallery = memo(function TemplateGallery({ mode, onSelect }: TemplateGalleryProps) {
  return <div className="studio-template-gallery">
    {mode === 'layout' ? <p className="property-note">Keep your map, text, and photos. Change the design.</p> : <h3 className="studio-template-heading">Designs</h3>}
    <div className="studio-template-grid">
      {POSTER_TEMPLATES.map((template) => <button type="button" className="studio-template-card" key={template.id} onClick={() => onSelect(template.id)}>
        <span className="studio-template-art" style={{ background: template.background, color: template.ink }}>
          <img src={MAP_STYLE_PRESETS.find(({ id }) => id === template.preset)?.thumbnailUrl} alt="" loading="lazy" />
          <strong>{template.name}</strong><small>YOUR PLACE / YOUR STORY</small>
        </span>
        <strong>{template.name}</strong><small>{template.description}</small>
      </button>)}
    </div>
    {mode === 'new-project' && <section className="studio-template-starters" aria-label="Starter locations">
      <h3 className="studio-template-heading">Start with a place</h3>
      <div className="studio-starter-grid">{POSTER_STARTERS.map((starter) =>
        <button type="button" key={starter.id} onClick={() => onSelect(starter.templateId, starter)}>
          <span className="studio-starter-icon" aria-hidden="true"><MapPin size={16} strokeWidth={1.8} /></span>
          <span className="studio-starter-text"><strong>{starter.name}</strong><small>{starter.subtitle}</small></span>
        </button>)}</div>
    </section>}
  </div>;
});
