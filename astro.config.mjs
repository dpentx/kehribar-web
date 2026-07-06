// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://kehribar.vercel.app',
  adapter: vercel(),
  // Prefetches a page's HTML as soon as its link becomes visible, so nav
  // clicks feel instant instead of triggering a visible full-page reload.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});