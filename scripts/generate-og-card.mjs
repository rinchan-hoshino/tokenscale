import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const OUT_PATH = path.resolve(process.cwd(), 'public/og-card.png');
const pricing = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/data/pricing-2026.json'), 'utf8'));
const modelCount = pricing.llmApiModels.length;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    background: #0F172A;
    color: #F8FAFC;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 46px 54px;
    overflow: hidden;
    position: relative;
  }
  .grid-bg {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }
  .top-bar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .brand-name {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #FFFFFF;
  }
  .badge {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 15px;
    font-weight: 600;
    color: #93C5FD;
    background: rgba(37, 99, 235, 0.18);
    border: 1px solid rgba(96, 165, 250, 0.35);
    padding: 7px 14px;
    border-radius: 6px;
    letter-spacing: 0.02em;
  }
  .main {
    position: relative;
    display: grid;
    grid-template-columns: 1.08fr 0.92fr;
    gap: 40px;
    align-items: center;
    margin-top: 6px;
  }
  .left h1 {
    font-size: 46px;
    line-height: 1.12;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #FFFFFF;
    margin-bottom: 18px;
  }
  .left p {
    font-size: 20px;
    line-height: 1.48;
    color: #CBD5E1;
    margin-bottom: 26px;
  }
  .pills {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .pill {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 15px;
    font-weight: 600;
    color: #E2E8F0;
    background: rgba(30, 41, 59, 0.85);
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 8px;
    padding: 10px 13px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .panel {
    background: #FFFFFF;
    color: #0F172A;
    border-radius: 14px;
    padding: 24px 26px;
    box-shadow: 0 24px 60px rgba(2, 6, 23, 0.45);
    border: 1px solid #E2E8F0;
  }
  .panel-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid #E2E8F0;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .panel-title {
    font-size: 16px;
    font-weight: 700;
    color: #0F172A;
  }
  .panel-sub {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    color: #475569;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 1px solid #E2E8F0;
  }
  .kpi-l {
    font-size: 12px;
    color: #475569;
    margin-bottom: 4px;
  }
  .kpi-v {
    font-size: 22px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    color: #0F172A;
  }
  .kpi-v.blue { color: #1D4ED8; }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 145px 1fr 72px;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    font-weight: 600;
  }
  .bar-label { color: #1E293B; white-space: nowrap; }
  .bar-track {
    height: 16px;
    background: #F1F5F9;
    border-radius: 4px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 4px;
  }
  .bar-val {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #0F172A;
    font-weight: 700;
  }
  .bottom-bar {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    padding-top: 16px;
    font-size: 15px;
    color: #94A3B8;
  }
  .url {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #E2E8F0;
    font-weight: 600;
  }
</style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="top-bar">
    <div class="brand">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="4" fill="#1D4ED8" stroke="#60A5FA" stroke-width="1.5" />
        <path d="M7 16V11.5M12 16V8.5M17 16V6.5" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" />
      </svg>
      <span class="brand-name">TokenScale</span>
    </div>
    <div class="badge">6-IN-1 FINOPS BENCH · v2026.11 · ZERO TELEMETRY</div>
  </div>

  <div class="main">
    <div class="left">
      <h1>AI &amp; Cloud Infrastructure Cost Simulators</h1>
      <p>Model prompt caching, GPU VRAM &amp; KV-cache, self-hosted break-even, cloud egress cliffs, RAG vector RAM, and Voice AI pipelines.</p>
      <div class="pills">
        <div class="pill"><span class="dot" style="background:#3B82F6"></span>LLM API &amp; Prompt Cache</div>
        <div class="pill"><span class="dot" style="background:#10B981"></span>GPU VRAM &amp; KV-Cache</div>
        <div class="pill"><span class="dot" style="background:#F59E0B"></span>GPU vs API Break-Even</div>
        <div class="pill"><span class="dot" style="background:#8B5CF6"></span>Cloud Storage &amp; Egress</div>
        <div class="pill"><span class="dot" style="background:#06B6D4"></span>RAG Vector DB Sizing</div>
        <div class="pill"><span class="dot" style="background:#EC4899"></span>Realtime Voice AI</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">LLM API Monthly Bench</span>
        <span class="panel-sub">45k req/day · 75% cache</span>
      </div>
      <div class="kpis">
        <div>
          <div class="kpi-l">Lowest / mo</div>
          <div class="kpi-v blue">$775</div>
        </div>
        <div>
          <div class="kpi-l">Cache Savings</div>
          <div class="kpi-v">-$6,156</div>
        </div>
        <div>
          <div class="kpi-l">Models</div>
          <div class="kpi-v">${modelCount} Frontier</div>
        </div>
      </div>
      <div class="bars">
        <div class="bar-row">
          <span class="bar-label">Claude Haiku 5.5</span>
          <div class="bar-track"><div class="bar-fill" style="width:8%;background:#0F766E"></div></div>
          <span class="bar-val">$0.8k</span>
        </div>
        <div class="bar-row">
          <span class="bar-label">DeepSeek V4.1</span>
          <div class="bar-track"><div class="bar-fill" style="width:16%;background:#475569"></div></div>
          <span class="bar-val">$2.0k</span>
        </div>
        <div class="bar-row">
          <span class="bar-label">GPT-6.1 Terra</span>
          <div class="bar-track"><div class="bar-fill" style="width:50%;background:#475569"></div></div>
          <span class="bar-val">$12.3k</span>
        </div>
        <div class="bar-row">
          <span class="bar-label">Claude Sonnet 5.5</span>
          <div class="bar-track"><div class="bar-fill" style="width:100%;background:#1D4ED8"></div></div>
          <span class="bar-val">$24.6k</span>
        </div>
        <div class="bar-row">
          <span class="bar-label">GPT-6.2 Sol</span>
          <div class="bar-track"><div class="bar-fill" style="width:100%;background:#1E293B"></div></div>
          <span class="bar-val">$24.6k</span>
        </div>
      </div>
    </div>
  </div>

  <div class="bottom-bar">
    <span>Shareable URLs &middot; One-click GitHub Markdown Tables &middot; Embeddable Widgets (?embed=1)</span>
    <span class="url">rinchan-hoshino.github.io/tokenscale</span>
  </div>
</body>
</html>`;

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: OUT_PATH, type: 'png' });
    console.log(`Generated ${OUT_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
