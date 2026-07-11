/**
 * 世界のカピバラ施設データ統合スクリプト（P3・/world/ 用）。
 *
 * 収集・検証済みの world-*.json（americas-oceania / europe-asia）を読み込み、
 * src/content/world/<slug>.json へ 1施設1ファイルで書き出す。
 *
 * liveChannelSlug の照合（重要）:
 *   world 側データにはエージェント推測の slug が入っているため、
 *   src/data/channels.json に**実在する** channels[].slug に合わせて補正する。
 *   - 実在 slug ならそのまま採用
 *   - 既知の推測 slug は CORRECTIONS で実在 slug に置換
 *   - channels[] に該当が無いもの（manualWatchlist にしか無いカメラ等）は null にする
 *     （liveChannelSlug はビューアのチャンネル切替に使うため、channels[].slug 以外は指せない）
 *
 * 実行: node scripts/import-world.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR =
  process.env.WORLD_DATA_DIR ??
  'C:/Users/tmucs/AppData/Local/Temp/claude/C--Users-tmucs-Desktop-Antigravity/475a0a66-64ab-446c-a374-83ab5ce37f30/scratchpad/facility-data/v2';

const SOURCE_FILES = ['world-americas-oceania.json', 'world-europe-asia.json'];

const OUT_DIR = resolve(__dirname, '..', 'src', 'content', 'world');
const CHANNELS_PATH = resolve(__dirname, '..', 'src', 'data', 'channels.json');

// 推測 slug → 実在 channels[].slug（または null）への明示補正。
const CORRECTIONS = {
  'angel-valley-farm-live': 'angel-valley-farm',
  'moscow-zoo-kapibara': 'moscow-zoo',
  'budapest-zoo-south-america': 'budapest-zoo',
  // 下記2件は channels[] に存在せず manualWatchlist のみ（切替チャンネルにできない）→ null
  'zamosc-zoo-hipopotam': null,
  'bella-siofok-cam': null,
};

// channels.json に実在する slug 集合
const channelsDb = JSON.parse(readFileSync(CHANNELS_PATH, 'utf8'));
const realSlugs = new Set((channelsDb.channels ?? []).map((c) => c.slug));

const OUT_KEYS = [
  'slug',
  'name',
  'nameEn',
  'country',
  'countryCode',
  'continent',
  'city',
  'lat',
  'lng',
  'latlngApprox',
  'officialUrl',
  'capybaraNote',
  'liveChannelSlug',
  'type',
  'sources',
  'lastVerified',
];

/** liveChannelSlug を実在 slug に補正して返す（[補正後, ログ用の元値]）。 */
function resolveLiveSlug(raw) {
  if (raw == null) return { value: null, note: null };
  if (realSlugs.has(raw)) return { value: raw, note: null }; // すでに実在
  if (Object.prototype.hasOwnProperty.call(CORRECTIONS, raw)) {
    const to = CORRECTIONS[raw];
    return { value: to, note: `${raw} → ${to == null ? 'null（channels[]に無し）' : to}` };
  }
  // 未知かつ実在しない → 安全側で null
  return { value: null, note: `${raw} → null（実在せず・未定義補正）` };
}

mkdirSync(OUT_DIR, { recursive: true });

const perFile = [];
const written = [];
const slugFixes = [];
const liveList = [];

for (const file of SOURCE_FILES) {
  const records = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
  perFile.push({ file, count: records.length });

  for (const rec of records) {
    if (!rec.slug) throw new Error(`slug 欠落: ${file} 内の "${rec.name ?? '(no name)'}"`);

    const { value: liveSlug, note } = resolveLiveSlug(rec.liveChannelSlug ?? null);
    if (note) slugFixes.push({ slug: rec.slug, fix: note });
    if (liveSlug) liveList.push({ slug: rec.slug, live: liveSlug });

    const out = {};
    for (const k of OUT_KEYS) {
      if (k === 'liveChannelSlug') {
        out[k] = liveSlug;
      } else if (k === 'latlngApprox') {
        out[k] = rec.latlngApprox === true;
      } else if (k === 'sources') {
        out[k] = Array.isArray(rec.sources) ? rec.sources : [];
      } else {
        out[k] = rec[k];
      }
    }

    writeFileSync(join(OUT_DIR, `${rec.slug}.json`), JSON.stringify(out, null, 2) + '\n', 'utf8');
    written.push(out);
  }
}

// --- サマリ ---
const byContinent = {};
for (const w of written) byContinent[w.continent] = (byContinent[w.continent] ?? 0) + 1;
const fileCount = readdirSync(OUT_DIR).filter((n) => n.endsWith('.json')).length;

console.log('=== import-world サマリ ===');
console.log('入力:', perFile.map((p) => `${p.file}(${p.count})`).join(' / '));
console.log(`書き出し件数: ${written.length} / ディレクトリ内 .json: ${fileCount}`);
console.log('大陸別:', JSON.stringify(byContinent));
console.log(`liveChannelSlug 補正: ${slugFixes.length}`);
for (const f of slugFixes) console.log(`  ${f.slug}: ${f.fix}`);
console.log(`カメラ付き施設（liveChannelSlug≠null）: ${liveList.length}`);
for (const l of liveList) console.log(`  ${l.slug} → ${l.live}`);
