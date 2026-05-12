# learnwithmanoj.com

Engineering blog and YouTube companion site for **LearnwithManoj** — *Never stop Learning.*

Built with [Astro](https://astro.build/) + MDX + Tailwind CSS. Ships as 100% static HTML for the fastest possible Core Web Vitals, with build-time YouTube channel sync (no API key needed) and exhaustive SEO metadata baked into every page.

---

## What's in the box

- **Static, SEO-optimized blog** — per-page `<title>`, meta description, canonical URL, Open Graph & Twitter cards.
- **JSON-LD structured data** — `WebSite`, `Person`, `BlogPosting`, `VideoObject`, `BreadcrumbList`.
- **MDX authoring** with embedded `<YouTubeEmbed />` and `<SubscribeCTA />` components.
- **Tagged topics** with auto-generated tag index and per-tag pages.
- **Auto-synced YouTube feed** — full channel inventory pulled at build time via the public Innertube API, with RSS feed used in parallel for accurate publish dates on recent videos. No API key required.
- **RSS feed** at `/rss.xml`, **sitemap** at `/sitemap-index.xml`, `robots.txt`.
- **Lazy "facade" YouTube embeds** so videos don't tank LCP.
- **Dark mode** via `prefers-color-scheme`.
- **GitHub Actions cron** to refresh the YouTube feed every 6 hours.

---

## Quick start

```bash
npm install
npm run dev        # local dev server on http://localhost:4321
npm run dev:fresh  # same, but clears Astro content caches first (use after adding/deleting an MDX file)
npm run build      # static output in ./dist
npm run preview    # serve the built site locally
npm run check      # type-check Astro + TS
```

> **Note:** Astro's first build prints a telemetry warning if `~/Library/Preferences/astro` isn't writable. Set `ASTRO_TELEMETRY_DISABLED=1` to silence it.

> **Heads-up — Astro 6.3 dev-server quirk:** if you create or delete an `.mdx` file while `npm run dev` is running, the dev server's content-collection module graph can get into a stale state and start throwing `UnknownContentCollectionError` for the new/changed post. The static `npm run build` is unaffected — only the live dev server gets confused. Stop the dev server (Ctrl-C) and start it with `npm run dev:fresh` to clear the caches. Editing an existing `.mdx` works fine without a restart.

---

## Configuration

All site-wide constants live in [`src/consts.ts`](src/consts.ts):

| Constant | Purpose |
| -------- | ------- |
| `SITE_URL` | Production URL — drives canonical, OG, sitemap, RSS. |
| `SITE_TITLE` / `SITE_DESCRIPTION` | Default `<title>` and meta description. |
| `YT_HANDLE` | Public channel handle (`@LearnwithManoj`). |
| `YT_CHANNEL_ID` | **Required for YouTube sync** — the `UC...` channel ID. |
| `GOOGLE_SITE_VERIFICATION` | Optional Search Console verification token. |
| `SOCIAL` | Links surfaced in JSON-LD `sameAs`. |

### Finding your YouTube channel ID

The channel ID is the `UC...` string, **not** the `@LearnwithManoj` handle.

1. Open `view-source:https://www.youtube.com/@LearnwithManoj` in a browser.
2. Search for `"channelId":"UC` — copy the value.
3. Paste it into `YT_CHANNEL_ID` in `src/consts.ts`.

Without it, the videos page renders an empty state and the homepage hides the "Latest videos" section. The site still builds — it just won't show videos.

---

## Writing a post

Drop a new `.mdx` file into [`src/content/posts/`](src/content/posts/). The filename (without extension) becomes the URL slug.

Frontmatter is strict — the build will fail if anything's missing or out of bounds. This is intentional: SEO metadata should never be silently absent.

```mdx
---
title: "Designing a rate limiter from first principles"
description: "A 1500-word walkthrough of token-bucket vs sliding-window rate limiters, with code, math, and the trade-offs that decide which one you actually want in production."
pubDate: 2026-06-01
updatedDate: 2026-06-03   # optional
tags: [system-design, performance, backend]
youtubeId: dQw4w9WgXcQ    # optional; emits VideoObject JSON-LD and embeds the video at the top
draft: false              # drafts are visible in dev, hidden in prod
---

import YouTubeEmbed from '@/components/YouTubeEmbed.astro';

Your post body in **MDX**. Embed code, callouts, and components.

<YouTubeEmbed id="dQw4w9WgXcQ" title="Designing a rate limiter" />
```

> **Don't** add `<SubscribeCTA />` inside the post body — `PostLayout.astro` automatically appends one at the bottom of every post (and an inline one at the top of posts that set a `youtubeId`). Putting it in the MDX too produces a duplicate.

Frontmatter constraints (see [`src/content.config.ts`](src/content.config.ts)):

- `title`: 10–80 chars
- `description`: 50–170 chars (sits in the OG/Twitter/meta description sweet spot)
- `tags`: array of strings, each ≥ 2 chars
- `youtubeId`: must be a valid 11-char YouTube video ID
- `heroImage`: optional image processed by `astro:assets`

---

## Project layout

```
.
├── astro.config.mjs            Astro + integrations (mdx, sitemap)
├── postcss.config.mjs          Tailwind v4 via PostCSS
├── public/
│   ├── favicon.svg
│   ├── og-default.svg          Source-of-truth for the default OG card
│   └── robots.txt
├── src/
│   ├── consts.ts               Site URL, channel ID, nav, social
│   ├── content.config.ts       Posts collection Zod schema
│   ├── content/posts/*.mdx     Blog posts
│   ├── components/             BaseHead, Header, Footer, PostCard, VideoCard, YouTubeEmbed, SubscribeCTA, JsonLd
│   ├── layouts/                BaseLayout, PostLayout
│   ├── lib/
│   │   ├── posts.ts            Pure helpers: published filter, tag math, related posts, reading time
│   │   ├── seo.ts              Pure helpers: canonical URLs, JSON-LD builders
│   │   └── youtube.ts          Innertube playlist enumeration + RSS merge for dates
│   ├── pages/
│   │   ├── index.astro         Home
│   │   ├── blog/index.astro    Blog archive
│   │   ├── blog/[slug].astro   Post route (getStaticPaths)
│   │   ├── tags/index.astro    All tags
│   │   ├── tags/[tag].astro    Posts for one tag
│   │   ├── videos.astro        Auto-synced channel videos
│   │   ├── about.astro
│   │   ├── 404.astro
│   │   └── rss.xml.ts          RSS feed
│   └── styles/global.css       Tailwind + theme tokens
├── scripts/
│   ├── list-channel-videos.mjs Enumerate all channel uploads to TSV (one-shot tool)
│   └── generate-posts.mjs      Batch-generate show-notes MDX from channel videos
├── vercel.json                 Production headers (security + cache) for Vercel
└── .github/workflows/refresh.yml   Cron to redeploy every 6h
```

---

## Generating the default OG image

`public/og-default.svg` is the editable source for the social-share card. Most platforms (Twitter, LinkedIn, Facebook, Slack) **don't render SVG OG images**, so generate a PNG once:

```bash
# Using rsvg-convert (brew install librsvg)
rsvg-convert -w 1200 -h 630 public/og-default.svg -o public/og-default.png

# Or using ImageMagick
magick public/og-default.svg -resize 1200x630 public/og-default.png

# Or use any online SVG-to-PNG converter at 1200x630.
```

`BaseHead.astro` references `/og-default.png` — once you generate it, every page picks it up automatically.

---

## Deploying

The site has no server runtime — it's 100% static, so no platform adapter is required. Any host that serves a directory of HTML works. Vercel is the documented happy path; Cloudflare Pages is a known-good alternative.

### Vercel (recommended)

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick this repo.
3. Vercel auto-detects Astro. Confirm the defaults and add one env var:
   - **Framework Preset:** Astro
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install` *(default)*
   - **Environment Variables:** `ASTRO_TELEMETRY_DISABLED` = `1` *(optional; silences the harmless telemetry warning)*
4. **Deploy.** The first build takes ~30s.
5. Project → **Settings** → **Domains** → add `learnwithmanoj.com` and `www.learnwithmanoj.com`. Vercel shows the exact A / CNAME records to set at your registrar.

The included [`vercel.json`](vercel.json) layers production hardening on top of Vercel's defaults:

- Security headers: HSTS (1y, includeSubDomains), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, and a tight `Permissions-Policy`.
- Longer browser cache (`max-age=7d, stale-while-revalidate=1d`) for the manually-managed `/og-default.*` asset (Astro's fingerprinted `/_astro/*` bundles get long-cache headers automatically from Vercel).

You don't need a custom routing config — Vercel handles Astro's directory-style URLs (`/blog/composite-pattern/index.html` → `/blog/composite-pattern`) natively.

### Cloudflare Pages (alternative)

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git** → pick this repo.
3. Build settings:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `ASTRO_TELEMETRY_DISABLED=1`
4. Add the custom domain `learnwithmanoj.com` under **Custom domains** and follow the DNS instructions.
5. Trigger the first deploy. (The `vercel.json` is ignored on Cloudflare — set equivalent headers via [`_headers`](https://developers.cloudflare.com/pages/configuration/headers/) if you want the same hardening.)

### Auto-refresh for new YouTube uploads

YouTube videos are pulled at **build time**, so a new upload won't appear until the site rebuilds. The GitHub Actions cron at [`.github/workflows/refresh.yml`](.github/workflows/refresh.yml) hits a deploy hook every 6 hours to keep the site fresh without any code push.

**Setup (Vercel):**

1. Vercel project → **Settings** → **Git** → **Deploy Hooks** → **Create Hook** → name it `cron-refresh`, target branch `main` → **Create** → copy the URL.
2. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** → name `DEPLOY_HOOK_URL`, value = the URL from step 1.
3. The cron fires every 6h automatically. To trigger manually: GitHub repo → **Actions** → **Refresh site (YouTube feed sync)** → **Run workflow**.

**Cloudflare Pages:** same flow, but get the hook URL from project → **Settings** → **Builds & deployments** → **Deploy hooks**. Store under the same secret name (`DEPLOY_HOOK_URL`).

---

## SEO checklist (already done for you)

- [x] Per-page `<title>`, meta description, canonical
- [x] Open Graph + Twitter Card metadata
- [x] JSON-LD: `WebSite`, `Person`, `BlogPosting`, `VideoObject`, `BreadcrumbList`
- [x] Sitemap (`/sitemap-index.xml`) referenced from `robots.txt`
- [x] RSS feed (`/rss.xml`) linked from `<head>`
- [x] Semantic HTML (`<article>`, `<time>`, breadcrumbs, single `<h1>` per page)
- [x] Fast LCP — static HTML, lazy YouTube facades, no client framework JS
- [x] Mobile-first responsive layout
- [x] Dark mode via `prefers-color-scheme`

After your first deploy:

1. Verify ownership in **Google Search Console** — either set `GOOGLE_SITE_VERIFICATION` in `src/consts.ts` (rebuild) or use the DNS TXT method.
2. Submit `https://learnwithmanoj.com/sitemap-index.xml` in Search Console.
3. Submit `https://learnwithmanoj.com/rss.xml` to any feed aggregators you care about.

---

## Tech stack

- [Astro 6](https://astro.build/) — static site generator
- [MDX](https://mdxjs.com/) — Markdown + JSX for posts
- [Tailwind CSS v4](https://tailwindcss.com/) (via `@tailwindcss/postcss`) + `@tailwindcss/typography`
- [Shiki](https://shiki.style/) — syntax highlighting (built into Astro)
- [youtubei.js](https://github.com/LuanRT/YouTube.js) — Innertube client for channel video enumeration (no API key)
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) — YouTube RSS parsing (used in parallel for accurate publish dates)
