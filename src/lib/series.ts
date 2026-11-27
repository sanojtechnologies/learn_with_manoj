/**
 * The channel's numbered series, read from the posts' tags and the episode
 * numbers printed in the YouTube titles. Numbers are only ever parsed from a
 * real title ("#11", "Part 18", "9/25"); a post whose titles carry none gets
 * no number rather than a guessed one.
 */
import type { Post } from '@/lib/posts';

export interface SeriesDef {
  slug: string;
  label: string;
  /** Tags that put a post in this series. */
  tags: readonly string[];
  /** Post slug marked "Start here", when the series has one. */
  start?: string;
}

export const SERIES: readonly SeriesDef[] = [
  { slug: 'system-design', label: 'System Design', tags: ['system-design'], start: 'what-is-system-design-beginners-roadmap' },
  { slug: 'design-patterns', label: 'Design Patterns', tags: ['design-patterns'], start: 'factory-method-pattern-vs-simple-factory-pattern-finally-explained' },
  { slug: 'ai', label: 'AI', tags: ['ai-masterclass', 'ai-explained'], start: 'ai-explained-finally-understand-how-ai-works-no-code' },
];

const NUMBER_PATTERNS = [/#(\d+)\b/u, /\bPart\s+(\d+)\b/iu, /\b(\d+)\s*\/\s*\d+\b/u];

export function episodeNumber(...titles: Array<string | undefined>): number | undefined {
  for (const title of titles) {
    if (!title) continue;
    for (const re of NUMBER_PATTERNS) {
      const m = title.match(re);
      if (m) return Number(m[1]);
    }
  }
  return undefined;
}

export interface Episode {
  post: Post;
  number?: number;
  isStart: boolean;
}

/** Posts in a series, ordered by episode number, then by date. */
export function seriesEpisodes(
  def: SeriesDef,
  posts: readonly Post[],
  videoTitles: ReadonlyMap<string, string>,
): Episode[] {
  return posts
    .filter((p) => p.data.tags.some((t) => def.tags.includes(t)))
    .map((post) => ({
      post,
      number: episodeNumber(
        post.data.youtubeId ? videoTitles.get(post.data.youtubeId) : undefined,
        post.data.title,
        post.data.description,
      ),
      isStart: post.id === def.start,
    }))
    .sort((a, b) => {
      if (a.number !== undefined && b.number !== undefined) return a.number - b.number;
      if (a.number !== undefined) return -1;
      if (b.number !== undefined) return 1;
      return a.post.data.pubDate.getTime() - b.post.data.pubDate.getTime();
    });
}
