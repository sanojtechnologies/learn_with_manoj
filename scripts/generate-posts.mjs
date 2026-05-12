// Batch-generate show-notes MDX posts for every channel video that matches
// one of the target series and doesn't already have a post.
//
// Pipeline per video:
//   fetch metadata via Innertube → parse description for chapters/links →
//   render an MDX file in src/content/posts/.
//
// Pure-ish: I/O is concentrated at the start (read inventory + existing
// posts) and end (writeFileSync). The renderers in the middle are pure
// functions so the post template can be unit-iterated without YouTube round-trips.

import { Innertube } from 'youtubei.js';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TSV = 'scripts/channel-videos.tsv';
const POSTS_DIR = 'src/content/posts';
const TITLE_MAX = 80;
const DESC_MIN = 50;
const DESC_MAX = 170;

// Series filters — each match function operates on the raw video title.
// `tags` are appended verbatim to the post frontmatter.
const SERIES = {
  ai_masterclass: {
    match: (t) => /\bAI\s+Masterclass\b/.test(t),
    tags: ['ai', 'ai-masterclass', 'llm', 'machine-learning', 'beginners'],
    label: 'AI Masterclass',
  },
  ai_explained: {
    match: (t) => /\bAI\s+Explained\b/.test(t),
    tags: ['ai', 'ai-explained', 'llm'],
    label: 'AI Explained',
  },
  system_design: {
    match: (t) => /System\s+Design\s*(?:#\d+|Interview|Beginner|Blueprint)/i.test(t),
    tags: ['system-design', 'architecture', 'scalability', 'backend'],
    label: 'System Design',
  },
  design_patterns: {
    match: (t) =>
      /Pattern\s*(?:Explained|-|—)/i.test(t) ||
      /\b(?:Singleton|Builder|Prototype|Abstract\s+Factory|Composite|Bridge|Adapter|Decorator)\b/i.test(t),
    tags: ['design-patterns', 'oop', 'software-engineering'],
    label: 'Design Patterns',
  },
};

const PATTERN_CATEGORY = (title) => {
  if (/\b(Singleton|Factory|Builder|Prototype|Abstract\s+Factory)\b/i.test(title)) return 'creational-patterns';
  if (/\b(Adapter|Bridge|Composite|Decorator|Facade|Flyweight|Proxy)\b/i.test(title)) return 'structural-patterns';
  if (/\b(Strategy|Observer|Command|Iterator|State|Template|Visitor|Mediator|Memento|Chain)\b/i.test(title)) return 'behavioral-patterns';
  return null;
};

// ---------------- Pure helpers ----------------

function classifyVideo(title) {
  for (const [key, def] of Object.entries(SERIES)) {
    if (def.match(title)) return key;
  }
  return null;
}

function cleanTitle(rawTitle) {
  let t = rawTitle;
  // Strip trailing pipe-delimited hashtags / noise.
  t = t.replace(/\s*\|\s*#\w+(?:\s*#\w+)*\s*$/u, '');
  // Strip leading "The AI Masterclass | Part N | " preamble — keep just the topic + part.
  t = t.replace(/^The\s+AI\s+Masterclass\s*\|\s*Part\s*(\d+)\s*\|\s*/iu, 'AI Masterclass Part $1: ');
  // Collapse double spaces, trim.
  t = t.replace(/\s{2,}/gu, ' ').trim();
  return t;
}

function fitTitle(title) {
  const cleaned = cleanTitle(title);
  if (cleaned.length <= TITLE_MAX) return cleaned;
  // Trim at last word boundary <= TITLE_MAX-1 (leaving room for an ellipsis).
  const cut = cleaned.slice(0, TITLE_MAX - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > TITLE_MAX * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s\-—|:,.]+$/u, '');
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[—–]/gu, '-')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

function buildSlug(title) {
  let s = cleanTitle(title);
  // Strip series numbering tail / parenthetical episode markers for cleaner slugs.
  s = s.replace(/\s*\([^)]*#\d+\)/gu, '');
  s = s.replace(/\s*\|\s*\d+\/\d+\s*$/u, '');
  s = s.replace(/\bPart\s*\d+\b\s*[:|-]?/iu, '');
  return slugify(s);
}

function buildTags(title, seriesKey) {
  const tags = [...SERIES[seriesKey].tags];
  if (seriesKey === 'design_patterns') {
    const cat = PATTERN_CATEGORY(title);
    if (cat) tags.push(cat);
  }
  // De-dup while preserving order.
  return [...new Set(tags)];
}

function smartTruncate(text, max) {
  if (!text) return text;
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastSentenceEnd > max * 0.5) return cut.slice(0, lastSentenceEnd + 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return base + '…';
}

/**
 * Pick the first "real" paragraph from a YouTube description. Many of this
 * channel's videos start with a pipe-delimited title-repeated preamble
 * (e.g. "The AI Masterclass | Part N | ...") that's worthless as a hook —
 * skip past it to the next paragraph that reads like prose.
 */
function pickHookParagraph(rawDescription) {
  if (!rawDescription) return '';
  const paragraphs = rawDescription
    .split(/\n\s*\n/u)
    .map((p) => p.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
  for (const p of paragraphs) {
    // Skip preambles that are just pipe-separated tags or short stub lines.
    if (p.length < 40) continue;
    if (p.split('|').length >= 3 && p.length < 160) continue;
    if (/^(?:full\s+(?:playlist|series)|chapters?|previous\s+video|next\s+video|gear|connect|follow|subscribe)\b/iu.test(p)) continue;
    return p;
  }
  return paragraphs[0] ?? '';
}

function buildMetaDescription(rawDescription, fittedTitle) {
  if (!rawDescription) return smartTruncate(`Show notes and chapter list for "${fittedTitle}" from the LearnwithManoj YouTube channel.`, DESC_MAX);
  const hook = pickHookParagraph(rawDescription);
  if (hook.length >= DESC_MIN && hook.length <= DESC_MAX) return hook;
  if (hook.length > DESC_MAX) return smartTruncate(hook, DESC_MAX);
  return smartTruncate(`${hook} (Show notes for "${fittedTitle}".)`, DESC_MAX);
}

// "0:00 - Title", "00:00 — Title", "12:34: Title", "1:23:45 - Title"
const CHAPTER_RE = /^\s*(?:[^\d\s][^A-Za-z0-9]?\s*)?((?:\d+:)?\d{1,2}:\d{2})\s*[-—:]\s+(.{2,})$/u;

function extractChapters(description) {
  if (!description) return [];
  const out = [];
  for (const line of description.split(/\r?\n/u)) {
    const m = line.match(CHAPTER_RE);
    if (!m) continue;
    out.push({ time: m[1].trim(), label: m[2].trim().replace(/\s{2,}/gu, ' ') });
  }
  return out;
}

const URL_RE = /(https?:\/\/[^\s)]+)/u;

function extractLinks(description) {
  const links = { playlist: null, prev: null, next: null, github: null };
  if (!description) return links;
  const lines = description.split(/\r?\n/u);
  for (const line of lines) {
    const lower = line.toLowerCase();
    const url = line.match(URL_RE)?.[1];
    if (!url) continue;
    if (!links.playlist && /(?:full\s+series|full\s+playlist|playlist)/.test(lower) && /playlist/i.test(url)) {
      links.playlist = url;
    } else if (!links.prev && /previous/.test(lower) && /(youtu\.be|watch\?v=)/.test(url) && !/\bNA\b/i.test(line)) {
      links.prev = url;
    } else if (!links.next && /\bnext\b/.test(lower) && /(youtu\.be|watch\?v=)/.test(url) && !/\bNA\b/i.test(line)) {
      links.next = url;
    } else if (!links.github && /github/.test(lower) && /github\.com/.test(url)) {
      links.github = url;
    }
  }
  return links;
}

function buildBody({ rawDescription, chapters, links, fittedTitle, lengthMin, lengthSec, seriesLabel, hubTag }) {
  const hookPara = pickHookParagraph(rawDescription);
  const hook = hookPara
    ? smartTruncate(hookPara, 420)
    : `Show notes for the ${seriesLabel} episode "${fittedTitle}".`;

  const lengthLabel = lengthMin || lengthSec
    ? ` (${lengthMin}m${lengthSec ? ` ${lengthSec}s` : ''})`
    : '';

  let body = `${hook}\n\n`;

  if (chapters.length > 0) {
    body += `## What's in the video${lengthLabel}\n\n`;
    for (const c of chapters) body += `- **${c.time}** — ${c.label}\n`;
    body += '\n';
  }

  const resources = [];
  if (links.playlist) resources.push(`- Full **${seriesLabel}** series: [YouTube playlist](${links.playlist})`);
  if (links.prev) resources.push(`- Previous episode: [${links.prev}](${links.prev})`);
  if (links.next) resources.push(`- Next episode: [${links.next}](${links.next})`);
  if (links.github) resources.push(`- Source notes / code: [${links.github}](${links.github})`);
  if (resources.length > 0) {
    body += `## Resources\n\n${resources.join('\n')}\n\n`;
  }

  body += `For more in this series, visit the [#${hubTag} tag page](/tags/${hubTag}) or jump to the [channel uploads list](/videos) for everything else.`;
  return body;
}

function renderFrontmatter({ title, description, pubDate, tags, youtubeId }) {
  // YAML escaping: wrap title/description in double-quotes and escape inner quotes/backslashes.
  const yamlStr = (s) => `"${s.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`;
  return [
    '---',
    `title: ${yamlStr(title)}`,
    `description: ${yamlStr(description)}`,
    `pubDate: ${pubDate}`,
    'tags:',
    ...tags.map((t) => `  - ${t}`),
    `youtubeId: ${youtubeId}`,
    '---',
    '',
  ].join('\n');
}

function toIsoDate(dateInput) {
  if (!dateInput) return new Date().toISOString().slice(0, 10);
  const d = new Date(dateInput);
  if (!Number.isNaN(d.valueOf())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

// ---------------- I/O orchestration ----------------

async function main() {
  const videos = readFileSync(TSV, 'utf8')
    .trim()
    .split(/\r?\n/u)
    .map((line) => {
      const cols = line.split('\t');
      return { id: cols[0], published: cols[1] || '', views: cols[2] || '', title: cols.slice(3).join('\t') };
    });

  const existingIds = new Set();
  const existingSlugs = new Set();
  for (const f of readdirSync(POSTS_DIR)) {
    if (!f.endsWith('.mdx')) continue;
    existingSlugs.add(f.replace(/\.mdx$/u, ''));
    const src = readFileSync(join(POSTS_DIR, f), 'utf8');
    const m = src.match(/^youtubeId:\s*([A-Za-z0-9_-]{11})/mu);
    if (m) existingIds.add(m[1]);
  }

  const targets = [];
  for (const v of videos) {
    const series = classifyVideo(v.title);
    if (!series) continue;
    if (existingIds.has(v.id)) continue;
    targets.push({ ...v, series });
  }

  console.error(`existing posts: ${existingIds.size}`);
  console.error(`videos matching target series:`, Object.keys(SERIES).reduce((acc, k) => {
    acc[k] = videos.filter((v) => classifyVideo(v.title) === k).length;
    return acc;
  }, {}));
  console.error(`to generate: ${targets.length}`);

  const yt = await Innertube.create({ retrieve_player: false });

  const generated = [];
  const errors = [];
  let i = 0;
  for (const v of targets) {
    i += 1;
    try {
      const info = await yt.getInfo(v.id);
      const basic = info.basic_info ?? {};
      const primary = info.primary_info ?? {};

      const rawTitle = basic.title ?? v.title;
      const fittedTitle = fitTitle(rawTitle);
      const slugBase = buildSlug(rawTitle);
      let slug = slugBase || `video-${v.id.toLowerCase()}`;
      let n = 2;
      while (existingSlugs.has(slug)) {
        slug = `${slugBase}-${n}`;
        n += 1;
      }
      existingSlugs.add(slug);

      const rawDescription = basic.short_description ?? '';
      const chapters = extractChapters(rawDescription);
      const links = extractLinks(rawDescription);

      const pubText = primary.published?.text ?? basic.publish_date ?? '';
      const pubDate = toIsoDate(pubText);

      const lengthSeconds = Number(basic.duration ?? 0);
      const lengthMin = Math.floor(lengthSeconds / 60);
      const lengthSec = lengthSeconds % 60;

      const tags = buildTags(rawTitle, v.series);
      const description = buildMetaDescription(rawDescription, fittedTitle);
      const body = buildBody({
        rawDescription,
        chapters,
        links,
        fittedTitle,
        lengthMin,
        lengthSec,
        seriesLabel: SERIES[v.series].label,
        hubTag: SERIES[v.series].tags[0],
      });

      const mdx = renderFrontmatter({
        title: fittedTitle,
        description,
        pubDate,
        tags,
        youtubeId: v.id,
      }) + body + '\n';

      const filepath = join(POSTS_DIR, `${slug}.mdx`);
      writeFileSync(filepath, mdx);
      generated.push({ slug, id: v.id, series: v.series });
      console.error(`  ✓ [${i}/${targets.length}] ${slug}.mdx`);
    } catch (err) {
      errors.push({ id: v.id, title: v.title, err: err.message });
      console.error(`  ✗ [${i}/${targets.length}] ${v.id} — ${err.message}`);
    }
  }

  console.error(`\n${generated.length} posts generated, ${errors.length} errors.`);
  if (errors.length > 0) {
    console.error('\nErrors:');
    for (const e of errors) console.error(`  ${e.id}  ${e.title}  →  ${e.err}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
