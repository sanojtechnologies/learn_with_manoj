// Record every channel upload's publish date in src/data/video-dates.json and
// a short description in src/data/video-descriptions.json.
//
// The build reads dates and descriptions from the RSS feed (latest ~15
// uploads) and then from these files. YouTube often refuses per-video lookups from cloud build servers,
// so run this on your own machine and commit the result:
//
//   npm run videos:dates
//
// Existing entries are kept; only uploads missing from the file are looked up.
// Upload dates never change, so the file only grows.

import { Innertube } from 'youtubei.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CHANNEL_ID = 'UCIBH6NpFY2CMvORLjPix6oQ'; // keep in sync with YT_CHANNEL_ID in src/consts.ts
const OUT = 'src/data/video-dates.json';
const OUT_DESC = 'src/data/video-descriptions.json';
const DESC_MAX = 300;
const CONCURRENCY = 8;

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {}; // first run: no file yet
  }
};
const existing = readJson(OUT);
const existingDesc = readJson(OUT_DESC);

// The opening of a description, cut at a sentence end where one falls near the cap.
const shorten = (text) => {
  // Keep the prose; drop the chapter list and anything after the first timestamp.
  const prose = String(text ?? '').split(/\s(?:\u23F1|Chapters?:|TIMESTAMPS|\(?\d{1,2}:\d{2}\b)/iu)[0];
  const clean = prose.replace(/\s+/gu, ' ').trim();
  if (clean.length <= DESC_MAX) return clean;
  const cut = clean.slice(0, DESC_MAX);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return end > DESC_MAX / 2 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}\u2026`;
};

const yt = await Innertube.create({ retrieve_player: false });

// Every upload ID, from the channel's uploads playlist (UU + channel suffix).
const ids = [];
let playlist = await yt.getPlaylist(CHANNEL_ID.replace(/^UC/u, 'UU'));
const ingest = (page) => {
  for (const item of page.videos ?? []) {
    if (item.content_type && item.content_type !== 'VIDEO') continue;
    const id = item.id ?? item.video_id ?? item.content_id;
    if (id && !ids.includes(id)) ids.push(id);
  }
};
ingest(playlist);
while (playlist.has_continuation) {
  playlist = await playlist.getContinuation();
  ingest(playlist);
}

const missing = ids.filter((id) => !existing[id] || !existingDesc[id]);
const found = {};
const foundDesc = {};
const failed = [];
const queue = [...missing];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        const info = await yt.getBasicInfo(id);
        const raw = info.basic_info?.publish_date ?? info.page?.[0]?.microformat?.publish_date;
        const date = raw ? new Date(raw) : null;
        if (date && !Number.isNaN(date.getTime())) found[id] = date.toISOString();
        else failed.push(id);
        const desc = shorten(info.basic_info?.short_description);
        if (desc) foundDesc[id] = desc;
      } catch {
        failed.push(id);
      }
    }
  }),
);

const merged = { ...existing, ...found };
const sorted = Object.fromEntries(Object.entries(merged).sort(([, a], [, b]) => (a < b ? 1 : -1)));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
const descs = { ...existingDesc, ...foundDesc };
const sortedDesc = Object.fromEntries(Object.keys(sorted).filter((id) => descs[id]).map((id) => [id, descs[id]]));
writeFileSync(OUT_DESC, `${JSON.stringify(sortedDesc, null, 2)}\n`);

console.log(
  `${ids.length} uploads: ${Object.keys(sorted).length} dated, ${Object.keys(sortedDesc).length} described, ${failed.length} failed`,
);
if (failed.length) console.log(`no date for: ${failed.join(', ')}`);
