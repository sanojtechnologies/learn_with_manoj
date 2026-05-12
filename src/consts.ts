/**
 * Site-wide constants. Single source of truth for URLs, branding, and the
 * YouTube channel binding. Pure values only — no I/O.
 */

export const SITE_URL = 'https://learnwithmanoj.com';
export const SITE_TITLE = 'LearnwithManoj';
export const SITE_TAGLINE = 'Never stop Learning.';
export const SITE_DESCRIPTION =
  'Never stop Learning — engineering tutorials, system design, and software craftsmanship. Written deep-dives and companion videos from the LearnwithManoj YouTube channel.';
export const SITE_LANG = 'en';
export const SITE_LOCALE = 'en_US';

export const AUTHOR_NAME = 'Manoj';
export const AUTHOR_BIO =
  'Software engineer sharing practical engineering tutorials and system design walkthroughs.';

export const YT_HANDLE = '@LearnwithManoj';
/**
 * Public YouTube channel ID (UC...) for the build-time RSS sync.
 * Resolved from the canonical channel URL of https://www.youtube.com/@LearnwithManoj.
 */
export const YT_CHANNEL_ID = 'UCIBH6NpFY2CMvORLjPix6oQ';
export const YT_CHANNEL_URL = `https://www.youtube.com/${YT_HANDLE}`;
export const YT_SUBSCRIBE_URL = `${YT_CHANNEL_URL}?sub_confirmation=1`;

export const SOCIAL = {
  youtube: YT_CHANNEL_URL,
  github: 'https://github.com/',
  twitter: 'https://twitter.com/',
} as const;

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
  { href: '/videos', label: 'Videos' },
  { href: '/tags', label: 'Topics' },
  { href: '/about', label: 'About' },
] as const;

/** Optional Google Search Console verification token (meta tag). */
export const GOOGLE_SITE_VERIFICATION: string | undefined = undefined;

export const DEFAULT_OG_IMAGE = '/og-default.png';
