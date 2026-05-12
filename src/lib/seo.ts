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

/** Resolve a path or absolute URL against {@link SITE_URL}. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//u.test(pathOrUrl)) return pathOrUrl;
  const base = SITE_URL.replace(/\/$/u, '');
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

export function resolveSeo(input: SeoInput): ResolvedSeo {
  const title = input.title.trim();
  const fullTitle =
    title === SITE_TITLE ? SITE_TITLE : `${title} — ${SITE_TITLE}`;
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
