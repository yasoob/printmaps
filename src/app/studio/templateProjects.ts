import { createNewProjectDocument, type ProjectDocument } from '../../domain/project';
import { createPosterTemplateApplication, POSTER_TEMPLATES, type PosterStarter, type PosterTemplate } from '../../domain/studioTemplates';
import { createProjectStore } from '../store';

export function currentLayoutApplication(document: ProjectDocument, id: PosterTemplate['id']) {
  const application = createPosterTemplateApplication(document, id);
  const current = document.studio.poster;
  for (const key of ['title', 'subtitle', 'caption'] as const) {
    application.poster[key] = {
      ...application.poster[key],
      text: current[key].text || (key === 'title' ? document.title : ''),
      enabled: current.enabled ? current[key].enabled : application.poster[key].enabled || current[key].enabled,
    };
  }
  return application;
}

export function createTemplateProject(id: PosterTemplate['id'], starter?: PosterStarter): ProjectDocument {
  const template = POSTER_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) throw new Error('Choose an available layout.');
  const store = createProjectStore(createNewProjectDocument());
  const title = store.getState().setProjectTitle(starter?.name ?? template.name);
  if (!title.ok) throw new Error(title.error);
  const application = createPosterTemplateApplication(store.getState().document, id, starter);
  const result = store.getState().applyStudioTemplate(application);
  if (!result.ok) throw new Error(result.error);
  return store.getState().document;
}
