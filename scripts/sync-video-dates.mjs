// Record every channel upload's publish date in src/data/video-dates.json.
//
// The build reads dates from the RSS feed (latest ~15 uploads) and then from
// this file. YouTube often refuses per-video lookups from cloud build servers,
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
const CONCURRENCY = 8;

let existing = {};
try {
  existing = JSON.parse(readFileSync(OUT, 'utf8'));
} catch {
  // first run: no file yet
}

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

const missing = ids.filter((id) => !existing[id]);
const found = {};
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

console.log(
  `${ids.length} uploads · ${Object.keys(existing).length} already recorded · ${Object.keys(found).length} added · ${failed.length} failed`,
);
if (failed.length) console.log(`no date for: ${failed.join(', ')}`);
