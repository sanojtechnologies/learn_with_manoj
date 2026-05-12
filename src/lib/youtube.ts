/**
 * Build-time YouTube channel sync.
 *
 * Primary path: enumerate the channel's "uploads" playlist via Innertube
 * (`youtubei.js`) so we surface *every* upload, not just the latest ~15.
 * Falls back to the public RSS feed if Innertube fails so a transient YouTube
 * UI change can never break the build.
 *
 * Pure parsing is split from network I/O so it stays unit-testable.
 */

import { XMLParser } from 'fast-xml-parser';
import { Innertube } from 'youtubei.js';

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnail: string;
  /**
   * Exact upload date. Optional because the Innertube playlist enumeration
   * (which we rely on for the full ~100-video list) doesn't expose dates per
   * item — we only know dates for the ~15 videos in the channel's RSS feed.
   */
  publishedAt?: Date;
  author: string;
}

const FEED_BASE = 'https://www.youtube.com/feeds/videos.xml';
const FETCH_TIMEOUT_MS = 10_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

// Module-scoped cache so multiple Astro pages built in the same process share
// a single round-trip to YouTube instead of re-paginating per page.
let videoCache: Promise<YouTubeVideo[]> | null = null;

/**
 * Fetch every upload for a channel. Uses Innertube first, falls back to RSS.
 * Returns videos sorted newest-first. Returns an empty array on total failure
 * so a flaky network or unset channel ID never breaks the build.
 */
export async function fetchLatestVideos(
  channelId: string,
): Promise<YouTubeVideo[]> {
  if (!channelId) {
    console.warn(
      '[youtube] YT_CHANNEL_ID is empty; skipping channel feed fetch.',
    );
    return [];
  }
  if (!videoCache) {
    videoCache = (async () => {
      // Run both data sources in parallel: Innertube gives us the full uploads
      // list (just IDs/titles/thumbnails, no dates), RSS gives accurate dates
      // for the latest ~15. Merge by ID, prefer RSS for shared fields.
      const [fromInnertube, fromRss] = await Promise.all([
        fetchFromInnertube(channelId),
        fetchFromRssFeed(channelId),
      ]);
      if (fromInnertube.length === 0 && fromRss.length === 0) return [];
      if (fromInnertube.length === 0) {
        console.warn('[youtube] Innertube returned 0 videos; using RSS only.');
        return fromRss;
      }
      const rssById = new Map(fromRss.map((v) => [v.id, v] as const));
      return fromInnertube.map((v) => {
        const rss = rssById.get(v.id);
        if (!rss) return v;
        return {
          ...v,
          // Prefer RSS for fields it provides authoritatively.
          title: rss.title || v.title,
          description: rss.description || v.description,
          publishedAt: rss.publishedAt ?? v.publishedAt,
          author: rss.author || v.author,
        };
      });
    })();
  }
  return videoCache;
}

/**
 * Enumerate the channel's auto-generated "uploads" playlist. Each YouTube
 * channel has a playlist with ID `UU` + (channel-ID suffix), holding every
 * public upload in reverse-chronological order.
 */
async function fetchFromInnertube(channelId: string): Promise<YouTubeVideo[]> {
  const uploadsId = channelId.replace(/^UC/u, 'UU');
  try {
    const yt = await Innertube.create({ retrieve_player: false });
    let playlist: any = await yt.getPlaylist(uploadsId);

    const seen = new Set<string>();
    const collected: YouTubeVideo[] = [];

    const ingestPage = (page: { videos?: unknown[] }) => {
      for (const raw of page.videos ?? []) {
        const video = innertubeItemToVideo(raw);
        if (!video || seen.has(video.id)) continue;
        seen.add(video.id);
        collected.push(video);
      }
    };

    ingestPage(playlist);
    while (playlist.has_continuation) {
      playlist = await playlist.getContinuation();
      ingestPage(playlist);
    }

    // Innertube returns the uploads playlist in reverse-chronological order
    // already; no need to sort (and we wouldn't have dates to sort by anyway).
    return collected;
  } catch (error) {
    console.warn(
      '[youtube] Innertube playlist fetch failed:',
      (error as Error).message,
    );
    return [];
  }
}

/**
 * Convert one Innertube playlist item into our flat `YouTubeVideo`. Returns
 * null if mandatory fields are missing so we don't pollute the page with
 * broken cards.
 */
function innertubeItemToVideo(raw: unknown): YouTubeVideo | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, any>;
  const id: string | undefined = item.id ?? item.video_id;
  if (!id) return null;

  const title: string = item.title?.text ?? '';
  if (!title) return null;

  const thumbnails: Array<{ url?: string }> = item.thumbnails ?? [];
  // Use the largest available; fall back to the deterministic ytimg URL.
  const thumbnail =
    thumbnails.reduce<string | undefined>((best, t) => best ?? t?.url, undefined) ??
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  // Playlist responses don't expose publish dates per item, so leave
  // `publishedAt` undefined here — the RSS merge in `fetchLatestVideos`
  // fills it in for the latest ~15 videos.
  return {
    id,
    title,
    description: '',
    url: `https://www.youtube.com/watch?v=${id}`,
    thumbnail,
    author: item.author?.name ?? '',
  };
}

// ------------------------- RSS path (used for dates) -------------------------

/**
 * Parse a YouTube channel RSS XML payload into a typed video array.
 * Exported for testing; safe to call with any string.
 */
export function parseChannelFeed(xml: string): YouTubeVideo[] {
  if (!xml) return [];
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return [];
  }
  const feed = (parsed as { feed?: { entry?: unknown } }).feed;
  if (!feed?.entry) return [];

  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
  const videos: YouTubeVideo[] = [];

  for (const entry of entries) {
    const video = entryToVideo(entry as Record<string, unknown>);
    if (video) videos.push(video);
  }
  return videos.sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  );
}

function entryToVideo(entry: Record<string, unknown>): YouTubeVideo | null {
  const videoId = readString(entry['yt:videoId']);
  const title = readString(entry['title']);
  const published = readString(entry['published']);
  if (!videoId || !title || !published) return null;

  const author = readString(
    (entry['author'] as Record<string, unknown> | undefined)?.['name'],
  );
  const mediaGroup = entry['media:group'] as Record<string, unknown> | undefined;
  const description = readString(mediaGroup?.['media:description']);
  const thumbnail =
    readAttr(mediaGroup?.['media:thumbnail'], '@_url') ??
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return {
    id: videoId,
    title,
    description: description ?? '',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail,
    publishedAt: new Date(published),
    author: author ?? '',
  };
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in value) {
    return readString((value as Record<string, unknown>)['#text']);
  }
  return undefined;
}

function readAttr(value: unknown, attr: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  if (attr in obj) return readString(obj[attr]);
  return undefined;
}

async function fetchFromRssFeed(channelId: string): Promise<YouTubeVideo[]> {
  const url = `${FEED_BASE}?channel_id=${encodeURIComponent(channelId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'learnwithmanoj-site/1.0 (+https://learnwithmanoj.com)' },
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(
        `[youtube] RSS feed returned ${response.status} for channel ${channelId}`,
      );
      return [];
    }
    const xml = await response.text();
    return parseChannelFeed(xml);
  } catch (error) {
    console.warn('[youtube] RSS fetch failed:', (error as Error).message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
