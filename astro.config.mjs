import { defineConfig } from 'astro/config';

// SITE_URL (e.g. https://brasil-em-mapas.vercel.app) is set at deploy time; without it the share-image tags are left out.
export default defineConfig({
  site: process.env.SITE_URL,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
