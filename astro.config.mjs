// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import { SITE_URL } from './src/consts.ts';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
  vite: {
    ssr: {
      // youtubei.js relies on a dynamic class registry that breaks when
      // Vite bundles + tree-shakes it for SSR. Keep it external so Node
      // loads it directly from node_modules at build time.
      external: ['youtubei.js'],
    },
  },
  integrations: [
    mdx({
      // Inherit Shiki settings from markdown config below.
    }),
    sitemap({
      filter: (page) => !page.includes('/404'),
      changefreq: 'weekly',
      priority: 0.7,
    }),
  ],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
});
