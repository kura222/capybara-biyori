// @ts-check
/**
 * ライブ検知スクリプト（仕様 §5 / requirements N-2）。
 *
 * 動作:
 *   1) channels.json の各チャンネルの RSS フィードを取得（APIクォータ消費ゼロ）
 *        https://www.youtube.com/feeds/videos.xml?channel_id=...
 *      → チャンネル毎の直近動画（videoId / title / published）を集約
 *   2) YouTube Data API videos.list（id最大50件バッチ・part=snippet,liveStreamingDetails）で
 *      liveBroadcastContent を判定し live[] / upcoming[] を生成
 *      APIキーは環境変数 YOUTUBE_API_KEY。
 *   3) data/live-status.json を出力（スキーマは spec §6 + latestVideos[] 拡張）
 *
 * 縮退モード（YOUTUBE_API_KEY が無い）:
 *   - videos.list を呼ばず、live[] / upcoming[] は空のまま。
 *   - RSS から latestVideos[]（新着動画フィード用）だけを生成する。
 *   - 出力に degraded:true を立てる。
 *
 * 出力先:
 *   - 既定: site/public/data/live-status.json（Astro が /data/live-status.json として配信 → ローカル確認用）
 *   - 環境変数 LIVE_STATUS_OUT で任意パスに上書き可（GitHub Actions が data ブランチ用に使用）
 *
 * 依存ゼロ（Node 22 の global fetch と標準ライブラリのみ）。
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** チャンネル毎に集約する直近動画の本数（新着フィード用） */
const LATEST_PER_CHANNEL = 4;
/** RSS 取得のタイムアウト（ms） */
const FETCH_TIMEOUT = 15000;

const API_KEY = process.env.YOUTUBE_API_KEY?.trim() || '';
const DEGRADED = API_KEY === '';

/** 出力先（既定は site/public/data/live-status.json） */
const OUT_PATH = process.env.LIVE_STATUS_OUT
  ? resolve(process.env.LIVE_STATUS_OUT)
  : resolve(__dirname, '../public/data/live-status.json');

/** channels.json の場所 */
const CHANNELS_PATH = resolve(__dirname, '../src/data/channels.json');

/**
 * 簡易 fetch（タイムアウト付き）。失敗は null を返す（1チャンネルの失敗で全体を止めない）。
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'capybara-biyori-live-checker/1.0' } });
    if (!res.ok) {
      console.warn(`  ! HTTP ${res.status}: ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`  ! fetch失敗: ${url} (${err instanceof Error ? err.message : err})`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 最小限の XML エンティティ復号 */
function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * YouTube チャンネル RSS をパースして直近動画を取り出す（依存ゼロの正規表現パース）。
 * @param {string} xml
 * @returns {{videoId:string,title:string,published:string}[]}
 */
function parseRssEntries(xml) {
  /** @type {{videoId:string,title:string,published:string}[]} */
  const entries = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const id = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    if (!id) continue;
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1] ?? '';
    entries.push({ videoId: id, title: decodeXml(title.trim()), published });
  }
  return entries;
}

/** 配列を size ごとに分割 */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log(`[check-live] 開始 ${new Date().toISOString()}  mode=${DEGRADED ? '縮退(RSSのみ)' : 'フル(RSS+API)'}`);

  const raw = JSON.parse(await readFile(CHANNELS_PATH, 'utf-8'));
  /** @type {any[]} */
  const channels = raw.channels ?? [];

  /** チャンネル毎の直近動画（新着フィード用）: [{channelSlug, name, videoId, title, published}] */
  const latestVideos = [];
  /** API 判定にかける候補動画ID（RSS直近 + 24h/seasonal の常設カメラID） */
  const candidateIds = new Set();
  /** videoId → channelSlug の対応（判定結果を戻すため） */
  const idToChannel = new Map();

  // display==='archive' は「よりぬきアーカイブ」の出典参照専用。ライブ検知・フィード対象外なので巡回しない
  const monitored = channels.filter((ch) => ch.display !== 'archive');

  // 常設カメラ（liveStreams）の動画IDも liveness 確認対象に含める（主に display==='always'）
  for (const ch of monitored) {
    for (const s of ch.liveStreams ?? []) {
      if (s.videoId) {
        candidateIds.add(s.videoId);
        idToChannel.set(s.videoId, ch.slug);
      }
    }
  }

  // RSS はチャンネル数分の取得になるため、直列でなく並列で取得する（監視chが増えても実行時間を抑える）
  const rssResults = await Promise.all(
    monitored.map(async (ch) => {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(ch.channelId)}`;
      const xml = await fetchText(url);
      return { ch, xml };
    }),
  );

  for (const { ch, xml } of rssResults) {
    if (!xml) {
      console.warn(`  - ${ch.slug}: RSS取得失敗（スキップ）`);
      continue;
    }
    const entries = parseRssEntries(xml).slice(0, LATEST_PER_CHANNEL);
    console.log(`  - ${ch.slug}: RSS ${entries.length}本`);

    for (const e of entries) {
      idToChannel.set(e.videoId, ch.slug);
      candidateIds.add(e.videoId);
      // display==='feed' のチャンネルのみ新着フィードに載せる（always=常設カメラ枠 / monitor=UI非表示）
      if (ch.display === 'feed') {
        latestVideos.push({
          channelSlug: ch.slug,
          channelName: ch.name,
          facilitySlug: ch.facilitySlug ?? null,
          videoId: e.videoId,
          title: e.title,
          published: e.published,
        });
      }
    }
  }

  // 新着フィードは公開日の新しい順に並べる
  latestVideos.sort((a, b) => (b.published || '').localeCompare(a.published || ''));

  const live = [];
  const upcoming = [];

  if (!DEGRADED && candidateIds.size > 0) {
    const ids = [...candidateIds];
    for (const group of chunk(ids, 50)) {
      const api = new URL('https://www.googleapis.com/youtube/v3/videos');
      api.searchParams.set('part', 'snippet,liveStreamingDetails');
      api.searchParams.set('id', group.join(','));
      api.searchParams.set('key', API_KEY);
      const body = await fetchText(api.toString());
      if (!body) continue;
      let json;
      try {
        json = JSON.parse(body);
      } catch {
        console.warn('  ! videos.list のJSON解析に失敗');
        continue;
      }
      for (const item of json.items ?? []) {
        const state = item.snippet?.liveBroadcastContent; // 'live' | 'upcoming' | 'none'
        const slug = idToChannel.get(item.id) ?? null;
        const base = {
          channelSlug: slug,
          videoId: item.id,
          title: item.snippet?.title ?? '',
        };
        if (state === 'live') {
          live.push({ ...base, startedAt: item.liveStreamingDetails?.actualStartTime ?? null });
        } else if (state === 'upcoming') {
          upcoming.push({ ...base, scheduledAt: item.liveStreamingDetails?.scheduledStartTime ?? null });
        }
      }
    }
    console.log(`  = 判定: live=${live.length} upcoming=${upcoming.length}`);
  } else if (DEGRADED) {
    console.log('  = 縮退モードのため live/upcoming 判定はスキップ');
  }

  const output = {
    updatedAt: new Date().toISOString(),
    // 縮退モード（APIキー無し）かどうか。フロントは live/upcoming の空を「本当に0件」と区別できる
    degraded: DEGRADED,
    live,
    upcoming,
    latestVideos,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`[check-live] 出力: ${OUT_PATH}`);
  console.log(`  latestVideos=${latestVideos.length} live=${live.length} upcoming=${upcoming.length} degraded=${DEGRADED}`);
}

main().catch((err) => {
  console.error('[check-live] 失敗:', err);
  process.exit(1);
});
