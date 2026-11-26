export function formatUsd(value: number, decimals?: number): string {
  if (!Number.isFinite(value)) return '$0';
  const abs = Math.abs(value);
  const d = decimals !== undefined ? decimals : abs >= 1000 ? 0 : abs >= 10 ? 2 : 3;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(value);
  return formatted;
}

export function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  if (abs >= 10) return `${sign}$${abs.toFixed(0)}`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}k`;
  return formatNumber(value, 0);
}

export function buildMarkdownTable(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  shareUrl: string,
  rightAlignCols: number[] = []
): string {
  const esc = (cell: string | number): string =>
    String(cell).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const alignSet = new Set(rightAlignCols);
  const headerLine = `| ${headers.map(esc).join(' | ')} |`;
  const sepLine = `| ${headers.map((_, i) => (alignSet.has(i) ? '---:' : ':---')).join(' | ')} |`;
  const bodyLines = rows.map((r) => `| ${r.map(esc).join(' | ')} |`);
  return [
    `### ${title}`,
    '',
    headerLine,
    sepLine,
    ...bodyLines,
    '',
    `*Simulated with [TokenScale](${shareUrl})*`,
  ].join('\n');
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (cell: string | number): string => {
    const s = String(cell);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
