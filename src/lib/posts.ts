/**
 * Helpers for working with the `posts` content collection.
 *
 * Centralizes the published/draft filter, sort order, and tag math so pages
 * stay declarative and the rules don't drift between routes.
 */

import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

const isPublished = (post: Post): boolean => {
  if (post.data.draft) return import.meta.env.DEV;
  return true;
};

const byNewestFirst = (a: Post, b: Post): number =>
  b.data.pubDate.getTime() - a.data.pubDate.getTime();

export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', isPublished);
  return posts.sort(byNewestFirst);
}

export function postUrl(post: Post): string {
  return `/blog/${post.id}`;
}

export function tagUrl(tag: string): string {
  return `/tags/${slugifyTag(tag)}`;
}

export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

export interface TagSummary {
  tag: string;
  slug: string;
  count: number;
}

export function summarizeTags(posts: readonly Post[]): TagSummary[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const slug = slugifyTag(tag);
      const existing = counts.get(slug);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(slug, { tag, count: 1 });
      }
    }
  }
  return Array.from(counts.entries())
    .map(([slug, { tag, count }]) => ({ slug, tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function findRelated(
  post: Post,
  all: readonly Post[],
  limit = 3,
): Post[] {
  const tagSet = new Set(post.data.tags.map(slugifyTag));
  if (tagSet.size === 0) return [];
  const scored = all
    .filter((candidate) => candidate.id !== post.id)
    .map((candidate) => {
      const overlap = candidate.data.tags.reduce(
        (acc, tag) => acc + (tagSet.has(slugifyTag(tag)) ? 1 : 0),
        0,
      );
      return { post: candidate, overlap };
    })
    .filter(({ overlap }) => overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        b.post.data.pubDate.getTime() - a.post.data.pubDate.getTime(),
    );
  return scored.slice(0, limit).map(({ post: p }) => p);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const WORDS_PER_MINUTE = 220;

export function readingTime(body: string | undefined): number {
  if (!body) return 1;
  const words = body.trim().split(/\s+/u).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
