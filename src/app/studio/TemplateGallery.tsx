import { memo } from 'react';
import { Check } from 'lucide-react';
import { POSTER_STARTERS, POSTER_TEMPLATES, type PosterStarter, type PosterTemplate } from '../../domain/studioTemplates';
import { MAP_STYLE_PRESETS } from '../../domain/mapStylePresets';
import './studioComposition.css';

export type TemplateGalleryProps = {
  mode: 'layout' | 'new-project';
  selectedId?: PosterTemplate['id'] | 'none';
  onSelect: (id: PosterTemplate['id'], starter?: PosterStarter) => void;
};

export const TemplateGallery = memo(function TemplateGallery({ mode, selectedId, onSelect }: TemplateGalleryProps) {
  return <div className="studio-template-gallery">
    <p className="property-note">{mode === 'layout' ? 'Keep your map, text, and photos. Change the design.' : 'Choose a design or start with a place.'}</p>
    <div className="studio-template-grid">
      {POSTER_TEMPLATES.map((template) => <button type="button" className="studio-template-card" key={template.id}
        aria-pressed={mode === 'layout' ? selectedId === template.id : undefined} onClick={() => onSelect(template.id)}>
        {selectedId === template.id && <span className="studio-template-check" aria-hidden="true"><Check size={12} strokeWidth={2.5} /></span>}
        <span className="studio-template-art" style={{ background: template.background, color: template.ink }}>
          <img src={MAP_STYLE_PRESETS.find(({ id }) => id === template.preset)?.thumbnailUrl} alt="" loading="lazy" />
          <strong>{template.name}</strong><small>YOUR PLACE / YOUR STORY</small>
        </span>
        <strong>{template.name}</strong><small>{template.description}</small>
      </button>)}
    </div>
    {mode === 'new-project' && <section className="studio-template-starters" aria-label="Starter locations">
      <h3>Start with a place</h3>
      <div className="studio-starter-grid">{POSTER_STARTERS.map((starter) =>
        <button type="button" key={starter.id} onClick={() => onSelect(starter.templateId, starter)}>
          <strong>{starter.name}</strong><small>{starter.subtitle}</small>
        </button>)}</div>
    </section>}
  </div>;
});
