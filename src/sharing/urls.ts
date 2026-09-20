import { publicAssetUrl } from '../domain/publicAssetUrl';
import { MAX_SHARE_URL_LENGTH, ShareError } from './codec';

export type SharedViewOptions = { embedded: boolean; navigation: boolean };

export function isSharedProjectHash(hash: string) {
  return /^#(?:share|embed)/i.test(hash);
}

export function parseSharedHash(hash: string) {
  if (hash.length > MAX_SHARE_URL_LENGTH) throw new ShareError('The shared map exceeds the 64 KB URL limit.');
  const match = /^#(share|embed)=([^&]+)(?:&navigation=(0|1))?$/.exec(hash);
  if (!match) throw new ShareError('The shared map link is malformed or incomplete.');
  return {
    payload: match[2],
    options: { embedded: match[1] === 'embed', navigation: match[3] !== '0' },
  };
}

function webUrl(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new ShareError('Share links require an HTTP or HTTPS address without credentials.');
  }
  return url;
}

export function createShareUrl(
  payload: string,
  options: SharedViewOptions,
  location?: { origin: string; baseUrl?: string },
) {
  const origin = webUrl(location?.origin ?? window.location.origin).origin;
  const url = new URL(publicAssetUrl('editor/', location?.baseUrl), origin);
  if (url.origin !== origin) throw new ShareError('Share links must use this editor’s origin.');
  url.search = '';
  url.hash = `${options.embedded ? 'embed' : 'share'}=${payload}${options.navigation ? '' : '&navigation=0'}`;
  if (url.href.length > MAX_SHARE_URL_LENGTH) throw new ShareError('This design is too large for the 64 KB share URL limit. Download the project instead.');
  return url.href;
}

function escapeAttribute(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function createEmbedHtml(url: string, title: string, height: number) {
  const source = webUrl(url);
  if (source.href.length > MAX_SHARE_URL_LENGTH) throw new ShareError('The embed URL exceeds the 64 KB limit.');
  if (!parseSharedHash(source.hash).options.embedded) throw new ShareError('An embed requires an embedded map link.');
  if (!Number.isSafeInteger(height) || height < 240 || height > 2000) throw new ShareError('Embed height must be between 240 and 2000 pixels.');
  return `<iframe src="${escapeAttribute(source.href)}" title="${escapeAttribute(title)}" width="100%" height="${height}" style="border:0" loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe>`;
}
