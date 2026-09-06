import { createNewProjectDocument } from '../../src/domain/project';
import { isPristineProjectDocument } from '../../src/domain/pristineProject';

it('recognizes untouched defaults independently of object-key order', () => {
  const document = createNewProjectDocument();
  expect(isPristineProjectDocument(document)).toBe(true);
  const camera = document.camera;
  document.camera = { zoom: camera.zoom, pitch: camera.pitch, locked: camera.locked, center: camera.center, bearing: camera.bearing };
  expect(isPristineProjectDocument(document)).toBe(true);
});

it('treats basemap-only camera, style, or identity changes as work worth protecting', () => {
  const camera = createNewProjectDocument();
  camera.camera.zoom = 14;
  expect(isPristineProjectDocument(camera)).toBe(false);
  const style = createNewProjectDocument();
  style.style.language = 'de';
  expect(isPristineProjectDocument(style)).toBe(false);
  const identity = createNewProjectDocument();
  identity.title = 'My map';
  expect(isPristineProjectDocument(identity)).toBe(false);
});
