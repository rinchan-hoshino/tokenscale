import { SITE_ORIGIN } from '../data/simulators';

export type ParamSpec = Record<string, 'number' | 'boolean' | 'string'>;

export function isEmbedMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('embed') === '1';
}

export function getCanonicalShareUrl(embed = false): string {
  if (typeof window === 'undefined') return SITE_ORIGIN;
  const params = new URLSearchParams(window.location.search);
  if (embed) {
    params.set('embed', '1');
  } else {
    params.delete('embed');
  }
  const qs = params.toString();
  return `${SITE_ORIGIN}${window.location.pathname}${qs ? `?${qs}` : ''}`;
}

export function buildEmbedSnippet(title = 'TokenScale Cost Simulator'): string {
  const src = getCanonicalShareUrl(true);
  const safeTitle = title.replace(/"/g, '&quot;');
  return `<iframe src="${src}" width="100%" height="760" style="border:0;border-radius:8px;overflow:hidden;" loading="lazy" title="${safeTitle}"></iframe>`;
}

export function readStateFromUrl<T extends Record<string, any>>(
  defaults: T,
  spec: ParamSpec
): T {
  const result = { ...defaults };
  if (typeof window === 'undefined') return result;
  const params = new URLSearchParams(window.location.search);
  for (const [key, type] of Object.entries(spec)) {
    const raw = params.get(key);
    if (raw === null) continue;
    if (type === 'number') {
      const n = Number(raw);
      if (Number.isFinite(n)) (result as any)[key] = n;
    } else if (type === 'boolean') {
      (result as any)[key] = raw === '1' || raw === 'true';
    } else {
      (result as any)[key] = raw;
    }
  }
  return result;
}

export function writeStateToUrl<T extends Record<string, any>>(
  state: T,
  spec: ParamSpec
): void {
  if (typeof window === 'undefined') return;
  const embed = isEmbedMode();
  const params = new URLSearchParams();
  for (const [key, type] of Object.entries(spec)) {
    const val = state[key];
    if (val === undefined || val === null) continue;
    if (type === 'boolean') {
      params.set(key, val ? '1' : '0');
    } else {
      params.set(key, String(val));
    }
  }
  if (embed) {
    params.set('embed', '1');
  }
  const qs = params.toString();
  const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', nextUrl);

  const fullLink = document.getElementById('embedFullLink') as HTMLAnchorElement | null;
  if (fullLink) {
    fullLink.href = getCanonicalShareUrl(false);
  }
}

export async function copyTextWithFeedback(
  button: HTMLButtonElement,
  text: string,
  copiedLabel: string,
  fallbackLabel = 'Copied'
): Promise<string> {
  const original = button.dataset.origLabel || button.textContent || 'Copy';
  button.dataset.origLabel = original;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = copiedLabel;
  } catch {
    button.textContent = fallbackLabel;
  }
  window.setTimeout(() => {
    button.textContent = original;
  }, 1800);
  return text;
}

export async function copyCurrentUrl(button: HTMLButtonElement): Promise<string> {
  return copyTextWithFeedback(
    button,
    getCanonicalShareUrl(false),
    'Scenario URL copied',
    'URL ready in address bar'
  );
}

export async function copyEmbedSnippet(
  button: HTMLButtonElement,
  title?: string
): Promise<string> {
  return copyTextWithFeedback(
    button,
    buildEmbedSnippet(title),
    'Embed code copied',
    'Embed snippet ready'
  );
}
