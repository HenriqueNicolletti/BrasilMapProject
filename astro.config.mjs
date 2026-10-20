import { defineConfig } from 'astro/config';

// The public address, needed for absolute share-image URLs. SITE_URL wins; on Vercel the build falls back to the
// production domain it exposes (VERCEL_PROJECT_PRODUCTION_URL, a bare host). With neither, the share-image tags are left out.
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export default defineConfig({
  site: process.env.SITE_URL ?? (vercelHost ? `https://${vercelHost}` : undefined),
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
