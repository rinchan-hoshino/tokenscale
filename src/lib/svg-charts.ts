import { formatCompactUsd } from './format';

export const CHART_COLORS = ['#1D4ED8', '#0D9488', '#D97706', '#7C3AED', '#E11D48'];

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface HorizontalBarItem {
  label: string;
  sublabel?: string;
  value: number;
  displayValue: string;
  color?: string;
  highlight?: boolean;
}

export function renderHorizontalBarChart(
  items: HorizontalBarItem[],
  opts: { title: string; unitLabel?: string }
): string {
  const width = 640;
  const rowH = 34;
  const topPad = 14;
  const bottomPad = 12;
  const labelW = 195;
  const valW = 95;
  const barMaxW = width - labelW - valW - 16;
  const height = topPad + items.length * rowH + bottomPad;
  const maxVal = Math.max(0.0001, ...items.map((d) => d.value));

  const rows = items
    .map((item, idx) => {
      const y = topPad + idx * rowH;
      const barW = Math.max(3, (item.value / maxVal) * barMaxW);
      const fill = item.color ?? (item.highlight ? CHART_COLORS[0] : '#64748B');
      return `
        <g transform="translate(0, ${y})">
          <text x="${labelW - 12}" y="21" text-anchor="end" fill="#0F172A" font-size="12.5" font-weight="${item.highlight ? '600' : '500'}">${esc(item.label)}</text>
          <rect x="${labelW}" y="7" width="${barMaxW}" height="18" rx="3" fill="#F1F5F9" />
          <rect x="${labelW}" y="7" width="${barW.toFixed(1)}" height="18" rx="3" fill="${fill}" />
          <text x="${labelW + barMaxW + 10}" y="21" text-anchor="start" fill="#0F172A" font-size="12.5" font-weight="600" style="font-variant-numeric: tabular-nums;">${esc(item.displayValue)}</text>
        </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(opts.title)}" style="display:block;height:auto;font-family:inherit;">
    ${rows}
  </svg>`;
}

export interface StackedBarSegment {
  label: string;
  value: number;
  color: string;
}

export interface StackedBarRow {
  label: string;
  totalDisplay: string;
  segments: StackedBarSegment[];
}

export function renderStackedBarChart(
  rows: StackedBarRow[],
  opts: { title: string; legend: { label: string; color: string }[] }
): string {
  const width = 640;
  const rowH = 38;
  const legendH = 28;
  const labelW = 195;
  const valW = 92;
  const barMaxW = width - labelW - valW - 16;
  const height = legendH + rows.length * rowH + 10;
  const maxVal = Math.max(
    0.0001,
    ...rows.map((r) => r.segments.reduce((s, seg) => s + seg.value, 0))
  );

  const legendStep = Math.min(108, (width - 140 - 16) / Math.max(1, opts.legend.length));
  const legendStart = Math.max(120, labelW - 36);
  const legendItems = opts.legend
    .map((l, i) => {
      const lx = legendStart + i * legendStep;
      return `<g transform="translate(${lx.toFixed(1)}, 6)">
        <rect width="10" height="10" rx="2" fill="${l.color}" y="2" />
        <text x="15" y="11.5" fill="#475569" font-size="12">${esc(l.label)}</text>
      </g>`;
    })
    .join('');

  const bars = rows
    .map((row, idx) => {
      const y = legendH + idx * rowH;
      let cursor = labelW;
      const segs = row.segments
        .map((seg) => {
          const w = Math.max(0, (seg.value / maxVal) * barMaxW);
          const rect =
            w > 0.5
              ? `<rect x="${cursor.toFixed(1)}" y="8" width="${w.toFixed(1)}" height="18" fill="${seg.color}" />`
              : '';
          cursor += w;
          return rect;
        })
        .join('');

      return `<g transform="translate(0, ${y})">
        <text x="${labelW - 12}" y="21" text-anchor="end" fill="#0F172A" font-size="12.5" font-weight="500">${esc(row.label)}</text>
        <rect x="${labelW}" y="8" width="${barMaxW}" height="18" rx="3" fill="#F1F5F9" />
        ${segs}
        <text x="${labelW + barMaxW + 10}" y="21" text-anchor="start" fill="#0F172A" font-size="12.5" font-weight="600" style="font-variant-numeric: tabular-nums;">${esc(row.totalDisplay)}</text>
      </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(opts.title)}" style="display:block;height:auto;font-family:inherit;">
    ${legendItems}
    ${bars}
  </svg>`;
}

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

export function renderLineChart(opts: {
  title: string;
  xLabels: string[];
  xAxisTitle: string;
  series: LineSeries[];
  yFormatter?: (v: number) => string;
  marker?: { xRatio: number; yValue: number; label: string } | null;
}): string {
  const width = 640;
  const height = 270;
  const padL = 68;
  const padR = 24;
  const padT = 34;
  const padB = 46;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const yFmt = opts.yFormatter ?? formatCompactUsd;

  const allVals = opts.series.flatMap((s) => s.values);
  const maxY = Math.max(1, ...allVals) * 1.12;
  const count = Math.max(2, opts.xLabels.length);

  const xPos = (i: number) => padL + (i / (count - 1)) * plotW;
  const yPos = (v: number) => padT + plotH - (Math.max(0, v) / maxY) * plotH;

  // Horizontal grid lines (4 intervals)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => {
    const val = maxY * r;
    const y = yPos(val);
    return `<g>
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="#E2E8F0" stroke-width="1" />
      <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#475569" font-size="12" style="font-variant-numeric: tabular-nums;">${esc(yFmt(val))}</text>
    </g>`;
  });

  // X-axis labels (pick up to 5 evenly spaced)
  const xStep = Math.max(1, Math.floor((count - 1) / 4));
  const xTicks: string[] = [];
  for (let i = 0; i < count; i += xStep) {
    xTicks.push(
      `<text x="${xPos(i).toFixed(1)}" y="${height - 20}" text-anchor="middle" fill="#475569" font-size="12" style="font-variant-numeric: tabular-nums;">${esc(opts.xLabels[i])}</text>`
    );
  }
  if ((count - 1) % xStep !== 0) {
    xTicks.push(
      `<text x="${xPos(count - 1).toFixed(1)}" y="${height - 20}" text-anchor="middle" fill="#475569" font-size="12" style="font-variant-numeric: tabular-nums;">${esc(opts.xLabels[count - 1])}</text>`
    );
  }

  // Lines
  const paths = opts.series
    .map((s) => {
      const d = s.values
        .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos(v).toFixed(1)}`)
        .join(' ');
      const dash = s.dashed ? ' stroke-dasharray="6 4"' : '';
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"${dash} />`;
    })
    .join('');

  // Legend top row
  const legendSpacing = Math.min(148, plotW / Math.max(1, opts.series.length));
  const legend = opts.series
    .map((s, i) => {
      const lx = padL + i * legendSpacing;
      return `<g transform="translate(${lx.toFixed(1)}, 10)">
        <line x1="0" y1="6" x2="14" y2="6" stroke="${s.color}" stroke-width="2.6" />
        <text x="20" y="10" fill="#0F172A" font-size="12.5" font-weight="500">${esc(s.name)}</text>
      </g>`;
    })
    .join('');

  // Optional crossover / highlight marker
  let markerSvg = '';
  if (opts.marker && opts.marker.xRatio >= 0 && opts.marker.xRatio <= 1) {
    const mx = padL + opts.marker.xRatio * plotW;
    const my = yPos(opts.marker.yValue);
    const alignRight = opts.marker.xRatio > 0.65;
    const tx = alignRight ? mx - 10 : mx + 10;
    const anchor = alignRight ? 'end' : 'start';
    markerSvg = `<g>
      <line x1="${mx.toFixed(1)}" y1="${padT}" x2="${mx.toFixed(1)}" y2="${padT + plotH}" stroke="#0F172A" stroke-width="1.2" stroke-dasharray="4 3" />
      <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" fill="#FFFFFF" stroke="#1D4ED8" stroke-width="2.5" />
      <text x="${tx.toFixed(1)}" y="${Math.max(padT + 14, my - 14).toFixed(1)}" text-anchor="${anchor}" fill="#0F172A" font-size="12.5" font-weight="600" paint-order="stroke" stroke="#FFFFFF" stroke-width="4" stroke-linejoin="round">${esc(opts.marker.label)}</text>
    </g>`;
  }

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(opts.title)}" style="display:block;height:auto;font-family:inherit;">
    ${legend}
    ${yTicks.join('')}
    ${paths}
    ${markerSvg}
    ${xTicks.join('')}
    <text x="${padL + plotW / 2}" y="${height - 3}" text-anchor="middle" fill="#475569" font-size="12">${esc(opts.xAxisTitle)}</text>
  </svg>`;
}
