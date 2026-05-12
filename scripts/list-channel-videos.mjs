// One-shot script to enumerate every video on a YouTube channel via InnerTube.
// Usage: node scripts/list-channel-videos.mjs UCxxxxxxxxxxxxxxxxxxxxx
// Output: tab-separated rows of `videoId<TAB>publishedRelative<TAB>title` to stdout.

import { Innertube } from 'youtubei.js';

const channelId = process.argv[2];
if (!channelId) {
  console.error('usage: node scripts/list-channel-videos.mjs <UC...>');
  process.exit(1);
}

// Every channel has an auto-generated "uploads" playlist with ID `UU` + the
// channel-ID suffix (the leading `UC` becomes `UU`). Fetching it via
// getPlaylist + continuations is the most reliable way to enumerate uploads.
const uploadsId = channelId.replace(/^UC/u, 'UU');

const yt = await Innertube.create({ retrieve_player: false });
let playlist = await yt.getPlaylist(uploadsId);

const out = [];
const seen = new Set();
const push = (v) => {
  if (!v?.id || seen.has(v.id)) return;
  seen.add(v.id);
  out.push({
    id: v.id,
    title: v.title?.text ?? '',
    published: v.published?.text ?? '',
    views: v.view_count?.text ?? '',
  });
};

for (const v of playlist.videos ?? []) push(v);

while (playlist.has_continuation) {
  playlist = await playlist.getContinuation();
  for (const v of playlist.videos ?? []) push(v);
}

for (const v of out) {
  process.stdout.write(`${v.id}\t${v.published}\t${v.views}\t${v.title}\n`);
}
console.error(`enumerated ${out.length} videos`);
