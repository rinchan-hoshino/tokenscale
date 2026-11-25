export type ParamSpec = Record<string, 'number' | 'boolean' | 'string'>;

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
  const qs = params.toString();
  const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', nextUrl);
}

export async function copyCurrentUrl(button: HTMLButtonElement): Promise<void> {
  const original = button.textContent ?? 'Copy scenario URL';
  try {
    await navigator.clipboard.writeText(window.location.href);
    button.textContent = 'Scenario URL copied';
  } catch {
    button.textContent = 'URL ready in address bar';
  }
  window.setTimeout(() => {
    button.textContent = original;
  }, 1800);
}
