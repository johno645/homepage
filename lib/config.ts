import type { LinksConfig, LinkItem } from '@/types/config';

function safeLinkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

const DEFAULT_NAME = 'Developer Homepage';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseLinksConfig(value: unknown): LinksConfig | null {
  if (!isRecord(value)) return null;

  const name = typeof value.name === 'string' && value.name.trim()
    ? value.name.trim()
    : DEFAULT_NAME;
  const linksValue = value.links ?? value.items;
  if (!Array.isArray(linksValue)) return null;

  const links: LinkItem[] = [];
  for (const entry of linksValue) {
    if (!isRecord(entry)
      || typeof entry.title !== 'string'
      || typeof entry.url !== 'string'
      || !safeLinkUrl(entry.url)
      || typeof entry.description !== 'string'
      || (entry.icon !== undefined && typeof entry.icon !== 'string')) {
      return null;
    }

    links.push({
      title: entry.title,
      url: entry.url,
      description: entry.description,
      ...(typeof entry.icon === 'string' ? { icon: entry.icon } : {}),
    });
  }

  return { name, links };
}

export function resolveLinksConfig(raw: string | undefined, fallback: LinksConfig): LinksConfig {
  if (raw) {
    try {
      const parsed = parseLinksConfig(JSON.parse(raw) as unknown);
      if (parsed) return parsed;
      console.error('HOMEPAGE_LINKS must contain a links or items array of valid link objects.');
    } catch (error: unknown) {
      console.error('Failed to parse HOMEPAGE_LINKS:', error);
    }
  }

  return fallback;
}
