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

/**
 * Tags that co-occur with `currentSlug` across the post corpus, sorted by
 * co-occurrence count. Used on `/tags/[tag]` pages to surface lateral
 * navigation and add real internal linking signal for SEO.
 *
 * Returns at most `limit` tags. Self-tag is always excluded.
 */
export function relatedTags(
  currentSlug: string,
  posts: readonly Post[],
  limit = 5,
): TagSummary[] {
  const cooccurrence = new Map<string, { tag: string; count: number }>();
  for (const post of posts) {
    const postTagSlugs = post.data.tags.map(slugifyTag);
    if (!postTagSlugs.includes(currentSlug)) continue;
    for (const rawTag of post.data.tags) {
      const slug = slugifyTag(rawTag);
      if (slug === currentSlug) continue;
      const existing = cooccurrence.get(slug);
      if (existing) existing.count += 1;
      else cooccurrence.set(slug, { tag: rawTag, count: 1 });
    }
  }
  return Array.from(cooccurrence.entries())
    .map(([slug, { tag, count }]) => ({ slug, tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
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

/**
 * Hand-written one-line descriptions for the major topic tags. Used by the
 * tag-index page and individual /tags/[tag] pages so each tag has real prose
 * for SEO (and so visitors see something more useful than just a post count).
 *
 * Tags without an explicit entry fall back to a generic message — see
 * {@link tagMeta}.
 */
const TAG_DESCRIPTIONS: Record<string, string> = {
  'system-design':
    'Scalability, load balancing, caching, sharding, CAP theorem, monolith versus microservices — the architectural decisions that decide whether your app survives its first growth spurt.',
  'design-patterns':
    'The Gang-of-Four patterns reframed without the ceremony. When each pattern solves a real problem, when it is overkill, and the code smells that call for it.',
  'creational-patterns':
    'Patterns for creating objects without coupling client code to concrete classes — Singleton, Factory Method, Abstract Factory, Builder, Prototype. With practical guidance on when each one actually helps.',
  'structural-patterns':
    'Patterns for composing classes and objects into larger structures while keeping the system flexible and efficient — Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy.',
  'behavioral-patterns':
    'Patterns for communication and responsibility-sharing between objects — Strategy, Observer, Command, Iterator, State, Template Method, Visitor, Mediator, Memento, Chain of Responsibility.',
  ai:
    'How LLMs actually work — tokenization, embeddings, RAG, fine-tuning, agents — explained for engineers who ship production code, not papers.',
  'ai-masterclass':
    'The AI Masterclass series: a numbered, beginner-friendly walkthrough of every concept you need to ship LLM-powered applications, from training to inference to RAG to alignment.',
  'ai-explained':
    'The AI Explained series: short, focused episodes on individual AI building blocks — transformers, attention, tokenization, memory, tool use, multi-agent systems, and more.',
  'ai-agents':
    'How autonomous AI agents reason, plan, use tools, and stay aligned with your intent — the ReAct loop, agentic RAG, and multi-agent orchestration.',
  llm:
    'Large language models — how they think, why they fail, what RAG fixes, and how to evaluate them. The fundamentals every engineer building on top of an LLM should internalise.',
  'machine-learning':
    'Machine learning from the perspective of someone shipping code, not writing papers. Algorithms, training, evaluation, and the practical trade-offs that decide which model you actually use.',
  beginners:
    'Posts written for people who are new to a topic — minimal jargon, real examples, and the context that more advanced material assumes you already have.',
  backend:
    'Server-side engineering — databases, APIs, queues, caching, performance, reliability. The unglamorous bits between the keyboard and a system that scales.',
  scalability:
    'Strategies for making systems handle more load — vertical and horizontal scaling, replication, sharding, caching, load balancing, consistent hashing. The mechanics of growth.',
  architecture:
    'High-level system architecture — monolith versus microservices, REST versus WebSockets versus SSE, choosing the right database, and shaping software around how it actually has to evolve.',
  oop:
    'Object-oriented programming as a working tool: inheritance, composition, polymorphism, encapsulation, and where each one helps or gets in the way.',
  'software-engineering':
    'The craft of building software well — design, testing, refactoring, performance, security, tooling, and the trade-offs that aren\u2019t in the Stack Overflow answer.',
  security:
    'Practical software security for engineers — secrets handling, threat modelling, least privilege, prompt injection, sandboxing, and AI-specific attack surfaces.',
};

const DEFAULT_TAG_DESCRIPTION = (tag: string) =>
  `Posts tagged #${tag} from LearnwithManoj — practical engineering tutorials and walkthroughs alongside the YouTube channel.`;

/**
 * Longer, multi-paragraph body lede shown on `/tags/[tag]`. Kept separate from
 * {@link tagMeta} (which feeds `<meta name="description">` and stays short
 * enough for SERP previews) so the same page can have rich on-page copy
 * without overflowing the meta-description pixel budget.
 */
const TAG_BODIES: Record<string, string> = {
  'ai-agents':
    "How autonomous AI agents reason, plan, use tools, remember context, and stay aligned with your intent. The posts collected here cover the ReAct loop and tool use, agentic RAG, multi-agent orchestration, short-term and long-term memory, semantic caching, and human-in-the-loop patterns for catching mistakes before they ship.\n\nThe series is opinionated about what makes an agent useful versus what makes it dangerous: which capabilities to grant, which to gate behind explicit approval, and which to refuse outright. Every post pairs the mental model with the trade-offs that come up the moment you try to put an agent in front of real users — latency, cost, evaluation, and the failure modes that emerge only at scale. Read them in order if you're new to agents, or skip to the topic you need to ship next.",
  security:
    "Practical software security from an engineer's perspective — secrets handling, threat modelling, least privilege, input validation, prompt injection, sandboxing, and the AI-specific attack surfaces that change the threat model. Each post focuses on how to think about risk before it bites in production: which mitigations actually move the needle, which ones are theatre, and how to design systems so a single bug doesn't become a single point of catastrophic failure.\n\nThe coverage spans the boring-but-essential (rotating credentials, locking down server access, sanitising user input) and the AI-era unknowns (prompt-injected agents, untrusted tool outputs, exfiltrating data through innocent-looking model responses). Written for engineers shipping code, not security consultants writing reports — every recommendation is something you can apply in your next pull request.",
};

/** Short meta description for a tag — safe to paste into `<meta name="description">`. */
export function tagMeta(slug: string, tag: string = slug): string {
  return TAG_DESCRIPTIONS[slug] ?? DEFAULT_TAG_DESCRIPTION(tag);
}

/**
 * Longer body lede for a tag page. Falls back to {@link tagMeta} when no
 * dedicated long-form copy is configured, so every page renders something
 * substantive without per-tag boilerplate.
 */
export function tagBody(slug: string, tag: string = slug): string {
  return TAG_BODIES[slug] ?? tagMeta(slug, tag);
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
