import type { APIRoute } from 'astro';
import { SIMULATORS, SITE_ORIGIN, withBase } from '../data/simulators';
import pricing from '../data/pricing-2026.json';

export const GET: APIRoute = () => {
  const lastmod = pricing.metadata.lastUpdated;
  const routes = [withBase('/'), ...SIMULATORS.map((s) => s.href), withBase('/about/')];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (path) => `  <url>
    <loc>${SITE_ORIGIN}${path}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
