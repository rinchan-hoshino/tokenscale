import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://rinchan-hoshino.github.io',
  base: '/tokenscale',
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
