import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

/**
 * Blog posts collection. MDX is the authoring format so posts can embed
 * <YouTubeEmbed />, callouts, and other Astro components inline.
 *
 * Frontmatter contract is intentionally strict so SEO metadata is never
 * silently missing — Zod will fail the build if a post forgets a description
 * or pubDate.
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(10).max(80),
      /**
       * Optional shorter title used only for the `<title>` tag, social cards
       * and structured data. Falls back to `title` when omitted. Use this when
       * a faithful YouTube-style title would push the SERP rendering past the
       * 580 px budget — the visible H1 keeps `title` so the page still matches
       * what readers see on YouTube.
       */
      seoTitle: z.string().min(10).max(65).optional(),
      description: z.string().min(50).max(170),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string().min(2)).default([]),
      heroImage: image().optional(),
      heroAlt: z.string().optional(),
      /** Optional related YouTube video; emits VideoObject JSON-LD when set. */
      youtubeId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{11}$/u, 'Must be an 11-char YouTube video id')
        .optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { posts };
