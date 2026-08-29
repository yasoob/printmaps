export function publicAssetUrl(path: string, baseUrl = import.meta.env.BASE_URL) {
  return `${baseUrl}${path.replace(/^\/+/, '')}`;
}
