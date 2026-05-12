/**
 * Pure helpers for SEO metadata and JSON-LD structured data.
 *
 * No I/O, no Astro APIs — easy to unit-test and reuse across pages.
 */

import {
  AUTHOR_BIO,
  AUTHOR_NAME,
  DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  SOCIAL,
  YT_CHANNEL_URL,
} from '@/consts';

export interface SeoInput {
  title: string;
  description: string;
  /** Path or absolute URL. Resolved against SITE_URL. */
  path: string;
  image?: string;
  imageAlt?: string;
  ogType?: 'website' | 'article';
  publishedAt?: Date;
  updatedAt?: Date;
  tags?: readonly string[];
  noindex?: boolean;
}

export interface ResolvedSeo {
  title: string;
  fullTitle: string;
  description: string;
  canonical: string;
  image: string;
  imageAlt: string;
  ogType: 'website' | 'article';
  publishedAt?: string;
  updatedAt?: string;
  tags: readonly string[];
  noindex: boolean;
}

/**
 * Resolve a path or absolute URL against {@link SITE_URL}.
 *
 * The site is configured with `trailingSlash: 'never'`, so every URL must be
 * emitted in its slashless form — including the root, which would otherwise
 * render as `https://learnwithmanoj.com/` and mismatch the URL that search
 * engines and SEO crawlers actually use (`https://learnwithmanoj.com`).
 */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//u.test(pathOrUrl)) return pathOrUrl;
  const base = SITE_URL.replace(/\/$/u, '');
  if (pathOrUrl === '' || pathOrUrl === '/') return base;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path.replace(/\/$/u, '')}`;
}

/**
 * Approximate pixel width of a title rendered in Google's SERP title font
 * (Arial 18 px). Numbers are tuned from public measurements; precise enough
 * to keep us inside the 580 px budget without shipping a real font metric.
 */
const TITLE_GLYPH_PX: Readonly<Record<string, number>> = {
  i: 5, l: 5, I: 6, j: 5, t: 6, f: 6, r: 6, '.': 5, ',': 5, ' ': 5,
  a: 9, b: 9, c: 8, d: 9, e: 9, g: 9, h: 9, k: 9, n: 9, o: 9, p: 9, q: 9,
  s: 8, u: 9, v: 8, x: 8, y: 8, z: 8,
  m: 14, w: 12, M: 14, W: 14,
  A: 12, B: 11, C: 12, D: 12, E: 11, F: 10, G: 12, H: 12, J: 8, K: 12,
  L: 10, N: 12, O: 13, P: 11, Q: 13, R: 12, S: 11, T: 11, U: 12, V: 12,
  X: 12, Y: 12, Z: 11,
  '&': 11, '-': 6, '—': 16, '–': 12, ':': 5, ';': 5, '/': 5, '|': 5,
  '(': 6, ')': 6, '!': 5, '?': 9, "'": 4, '"': 7, '#': 9,
};
const TITLE_DEFAULT_PX = 9; // ~mid-width fallback for any glyph not in the table

function titlePixelWidth(s: string): number {
  let total = 0;
  for (const c of s) total += TITLE_GLYPH_PX[c] ?? TITLE_DEFAULT_PX;
  return total;
}

const TITLE_PIXEL_BUDGET = 580;
const TITLE_SUFFIX = ` — ${SITE_TITLE}`;
const TITLE_SUFFIX_PX = titlePixelWidth(TITLE_SUFFIX);

export function resolveSeo(input: SeoInput): ResolvedSeo {
  const title = input.title.trim();
  // The brand suffix gets dropped on pages whose own title is already wide
  // enough that ` — ${SITE_TITLE}` would push the whole thing past Google's
  // ~580 px SERP cutoff. Keeping page-specific keywords visible matters more
  // than repeating the brand the user already saw in the URL bar.
  let fullTitle: string;
  if (title === SITE_TITLE) {
    fullTitle = SITE_TITLE;
  } else if (titlePixelWidth(title) + TITLE_SUFFIX_PX <= TITLE_PIXEL_BUDGET) {
    fullTitle = `${title}${TITLE_SUFFIX}`;
  } else {
    fullTitle = title;
  }
  return {
    title,
    fullTitle,
    description: input.description.trim(),
    canonical: absoluteUrl(input.path),
    image: absoluteUrl(input.image ?? DEFAULT_OG_IMAGE),
    imageAlt: input.imageAlt ?? title,
    ogType: input.ogType ?? 'website',
    publishedAt: input.publishedAt?.toISOString(),
    updatedAt: input.updatedAt?.toISOString(),
    tags: input.tags ?? [],
    noindex: input.noindex ?? false,
  };
}

// ---------------------------------------------------------------------------
// JSON-LD builders. Each returns a plain object meant to be JSON.stringify'd
// into a <script type="application/ld+json"> tag.
// ---------------------------------------------------------------------------

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_TITLE,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/blog?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: AUTHOR_NAME,
    description: AUTHOR_BIO,
    url: SITE_URL,
    sameAs: [YT_CHANNEL_URL, SOCIAL.github, SOCIAL.twitter].filter(Boolean),
  };
}

export interface BlogPostingInput {
  title: string;
  description: string;
  url: string;
  image: string;
  publishedAt: string;
  updatedAt?: string;
  tags?: readonly string[];
}

export function blogPostingJsonLd(input: BlogPostingInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    description: input.description,
    image: [input.image],
    datePublished: input.publishedAt,
    dateModified: input.updatedAt ?? input.publishedAt,
    author: {
      '@type': 'Person',
      name: AUTHOR_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_TITLE,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/favicon.svg'),
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': input.url,
    },
    keywords: input.tags?.join(', '),
    inLanguage: 'en',
  };
}

export interface VideoObjectInput {
  videoId: string;
  name: string;
  description: string;
  uploadDate?: string;
  thumbnailUrl?: string;
}

export function videoObjectJsonLd(input: VideoObjectInput) {
  const thumbnailUrl =
    input.thumbnailUrl ??
    `https://i.ytimg.com/vi/${input.videoId}/maxresdefault.jpg`;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: input.name,
    description: input.description,
    thumbnailUrl: [thumbnailUrl],
    uploadDate: input.uploadDate,
    contentUrl: `https://www.youtube.com/watch?v=${input.videoId}`,
    embedUrl: `https://www.youtube.com/embed/${input.videoId}`,
    publisher: {
      '@type': 'Organization',
      name: SITE_TITLE,
      url: SITE_URL,
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}
