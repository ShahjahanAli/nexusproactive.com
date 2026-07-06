import { getPublicApiUrl } from './public-api-url';

export function buildEmbedSnippet(siteId: string, apiUrl = getPublicApiUrl()): string {
  const base = apiUrl.replace(/\/+$/, '');
  return `<script>window.NEXUS_API_URL='${base}';</script>\n<script src="${base}/widget/nexus.js" defer></script>\n<nexus-chat site-id="${siteId}"></nexus-chat>`;
}
