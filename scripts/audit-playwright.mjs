import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const DIST_DIR = path.resolve(process.cwd(), 'dist');

const ROUTES = [
  '/',
  '/llm-api-cost-calculator/',
  '/llm-vram-calculator/',
  '/gpu-vs-api-breakeven/',
  '/cloud-egress-calculator/',
  '/rag-vector-cost-calculator/',
  '/voice-ai-cost-calculator/',
  '/about/',
];

const SIM_INTERACTIONS = [
  { route: '/llm-api-cost-calculator/', slider: '#dailyRequestsRange', newVal: '120000', svgContainer: '#barChartStage', param: 'dailyRequests=120000' },
  { route: '/llm-vram-calculator/', slider: '#contextRange', newVal: '65536', svgContainer: '#vramBarStage', param: 'contextLength=65536' },
  { route: '/gpu-vs-api-breakeven/', slider: '#dailyTokensRange', newVal: '180', svgContainer: '#crossoverChartStage', param: 'dailyTokensM=180' },
  { route: '/cloud-egress-calculator/', slider: '#egressRange', newVal: '250', svgContainer: '#cliffChartStage', param: 'egressTB=250' },
  { route: '/rag-vector-cost-calculator/', slider: '#qpsRange', newVal: '180', svgContainer: '#ragBarStage', param: 'queryQps=180' },
  { route: '/voice-ai-cost-calculator/', slider: '#callsRange', newVal: '12000', svgContainer: '#voiceBarStage', param: 'dailyCalls=12000' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      let filePath = path.join(DIST_DIR, urlPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

function measureGzippedJs() {
  let totalRaw = 0;
  let totalGzip = 0;
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) {
        const buf = fs.readFileSync(full);
        const gz = zlib.gzipSync(buf);
        totalRaw += buf.length;
        totalGzip += gz.length;
        files.push({ name: path.relative(DIST_DIR, full), raw: buf.length, gz: gz.length });
      }
    }
  };
  walk(DIST_DIR);
  return { totalRaw, totalGzip, files };
}

async function main() {
  const jsStats = measureGzippedJs();
  console.log(`JS Bundle Check: ${jsStats.files.length} files, total ${(jsStats.totalGzip / 1024).toFixed(2)} KB gzipped (${(jsStats.totalRaw / 1024).toFixed(2)} KB raw)`);
  if (jsStats.totalGzip > 35 * 1024) {
    throw new Error(`Total gzipped JS ${(jsStats.totalGzip / 1024).toFixed(2)}KB exceeds 35KB budget!`);
  }

  const { server, port } = await startStaticServer();
  const origin = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  const errors = [];
  const externalRequests = [];

  try {
    // Verify sitemap.xml and robots.txt
    for (const metaPath of ['/sitemap.xml', '/robots.txt']) {
      const resp = await fetch(`${origin}${metaPath}`);
      if (resp.status !== 200) errors.push(`${metaPath} returned HTTP ${resp.status}`);
    }

    // 1. Desktop 1440x900@2x audit across all 8 routes
    const desktopCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await desktopCtx.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`[console.error] ${page.url()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      errors.push(`[pageerror] ${page.url()}: ${err.message}`);
    });
    page.on('request', (req) => {
      const u = req.url();
      if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) {
        externalRequests.push(`${page.url()} -> ${u}`);
      }
    });

    const internalLinks = new Set();

    for (const route of ROUTES) {
      const resp = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
      if (!resp || resp.status() !== 200) {
        errors.push(`Route ${route} returned status ${resp?.status()}`);
        continue;
      }

      // Check horizontal overflow
      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      if (overflow.scrollW > overflow.clientW) {
        errors.push(`Desktop overflow on ${route}: scrollWidth=${overflow.scrollW} > clientWidth=${overflow.clientW}`);
      }

      // Check WCAG AA contrast on key text selectors
      const contrastFailures = await page.evaluate(() => {
        const parseRgb = (str) => {
          const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
          if (!m) return null;
          return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
        };
        const lum = ({ r, g, b }) => {
          const f = (c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const getBg = (el) => {
          let cur = el;
          while (cur) {
            const bg = parseRgb(getComputedStyle(cur).backgroundColor);
            if (bg && bg.a > 0.1) return bg;
            cur = cur.parentElement;
          }
          return { r: 248, g: 250, b: 252, a: 1 };
        };
        const sels = ['h1', '.page-subtitle', '.kpi-label', '.kpi-value', '.control-label', '.site-footer'];
        const bad = [];
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (!el) continue;
          const fg = parseRgb(getComputedStyle(el).color);
          const bg = getBg(el);
          if (!fg || !bg) continue;
          const l1 = Math.max(lum(fg), lum(bg));
          const l2 = Math.min(lum(fg), lum(bg));
          const ratio = (l1 + 0.05) / (l2 + 0.05);
          if (ratio < 4.5) bad.push(`${sel}: ${ratio.toFixed(2)}:1`);
        }
        return bad;
      });
      if (contrastFailures.length > 0) {
        errors.push(`Contrast failure on ${route}: ${contrastFailures.join(', ')}`);
      }

      // Collect internal links
      const hrefs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'))
      );
      for (const h of hrefs) {
        if (h && h.startsWith('/')) internalLinks.add(h);
      }

      // Capture desktop screenshots
      if (route === '/') {
        await page.screenshot({ path: '/tmp/finops-sim-home-desktop.png', fullPage: false });
      } else if (route === '/llm-api-cost-calculator/') {
        await page.screenshot({ path: '/tmp/finops-sim-api.png', fullPage: false });
      } else if (route === '/llm-vram-calculator/') {
        await page.screenshot({ path: '/tmp/finops-sim-vram.png', fullPage: false });
      } else if (route === '/gpu-vs-api-breakeven/') {
        await page.screenshot({ path: '/tmp/finops-sim-breakeven.png', fullPage: false });
      }
    }

    // Verify all discovered internal links return 200
    for (const link of internalLinks) {
      const resp = await fetch(`${origin}${link}`);
      if (resp.status !== 200) errors.push(`Broken internal link ${link}: HTTP ${resp.status}`);
    }

    // 2. Interactive slider -> SVG & URL query sync verification across all 6 simulators
    for (const sim of SIM_INTERACTIONS) {
      await page.goto(`${origin}${sim.route}`, { waitUntil: 'networkidle' });
      const beforeSvg = await page.locator(sim.svgContainer).innerHTML();
      await page.locator(sim.slider).fill(sim.newVal);
      await page.locator(sim.slider).dispatchEvent('input');
      const afterSvg = await page.locator(sim.svgContainer).innerHTML();
      const afterUrl = page.url();
      if (beforeSvg === afterSvg) {
        errors.push(`SVG did not update on slider change for ${sim.route}`);
      }
      if (!afterUrl.includes(sim.param)) {
        errors.push(`URL query did not sync (${sim.param}) on ${sim.route}, got ${afterUrl}`);
      }
    }

    await desktopCtx.close();

    // 3. Mobile 390x844@2x audit across all 8 routes
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const mPage = await mobileCtx.newPage();
    mPage.on('pageerror', (err) => errors.push(`[mobile pageerror] ${mPage.url()}: ${err.message}`));

    for (const route of ROUTES) {
      await mPage.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
      const overflow = await mPage.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      if (overflow.scrollW > overflow.clientW) {
        errors.push(`Mobile overflow on ${route}: scrollWidth=${overflow.scrollW} > clientWidth=${overflow.clientW}`);
      }
      if (route === '/') {
        await mPage.screenshot({ path: '/tmp/finops-sim-home-mobile.png', fullPage: false });
      } else if (route === '/llm-api-cost-calculator/') {
        await mPage.screenshot({ path: '/tmp/finops-sim-api-mobile.png', fullPage: false });
      }
    }
    await mobileCtx.close();

    if (externalRequests.length > 0) {
      errors.push(`External network requests detected: ${externalRequests.join('; ')}`);
    }

    // Stitch audit grid via Python PIL
    const pyScript = `
from PIL import Image
d1 = Image.open('/tmp/finops-sim-home-desktop.png').resize((1440, 900), Image.LANCZOS)
d2 = Image.open('/tmp/finops-sim-api.png').resize((1440, 900), Image.LANCZOS)
d3 = Image.open('/tmp/finops-sim-vram.png').resize((1440, 900), Image.LANCZOS)
d4 = Image.open('/tmp/finops-sim-breakeven.png').resize((1440, 900), Image.LANCZOS)
m1 = Image.open('/tmp/finops-sim-home-mobile.png').resize((416, 900), Image.LANCZOS)
m2 = Image.open('/tmp/finops-sim-api-mobile.png').resize((416, 900), Image.LANCZOS)

pad = 24
W = 1440 * 2 + 416 + pad * 4
H = 900 * 2 + pad * 3
canvas = Image.new('RGB', (W, H), (226, 232, 240))
canvas.paste(d1, (pad, pad))
canvas.paste(d2, (1440 + pad * 2, pad))
canvas.paste(m1, (1440 * 2 + pad * 3, pad))
canvas.paste(d3, (pad, 900 + pad * 2))
canvas.paste(d4, (1440 + pad * 2, 900 + pad * 2))
canvas.paste(m2, (1440 * 2 + pad * 3, 900 + pad * 2))
canvas.save('/tmp/finops-sim-audit.png', optimize=True)
print('Saved /tmp/finops-sim-audit.png', canvas.size)
`;
    execFileSync('python3', ['-c', pyScript], { stdio: 'inherit' });

    if (errors.length > 0) {
      console.error('AUDIT FAILED:\n' + errors.map((e) => '  - ' + e).join('\n'));
      process.exitCode = 1;
    } else {
      console.log('ALL 8 ROUTES PASSED PLAYWRIGHT AUDIT (0 console/page errors, 0 external requests, 0 broken links, 0 overflow, WCAG AA >= 4.5:1, 6/6 live slider->SVG+URL sync).');
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
