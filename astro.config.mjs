import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tokenscale.dev',
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
