/**
 * 全国カピバラ施設データ統合スクリプト（P1）。
 *
 * 別エージェント4体が収集・検証した地方別JSON（north / west-south / tokai-kansai / kanto）を
 * 読み込んで結合し、コンテンツコレクション（src/content/facilities/<slug>.json）へ
 * 1施設1ファイルで書き出す。
 *
 * 正規化ルール:
 *   - slug 重複は「後から読んだファイルが先を上書き」（＝既存シードを収集データで上書き）
 *   - fees が null → []
 *   - sources の文字列配列 → [{ label, url, official }]
 *       official 判定 = URL ホストが officialUrl ホストと一致（www. は無視）。officialUrl 無しなら false
 *       label = official なら「公式サイト」、それ以外は「参考情報」
 *   - lat / lng 未定義 → null（地図にピンを打たずカード一覧のみに出す）
 *   - officialUrl 未定義/空 → null（リンク非表示）
 *
 * 実行: node scripts/import-facilities.mjs
 * 収集データの場所は環境変数 FACILITY_DATA_DIR で上書き可。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 収集データの置き場所（セッションのスクラッチパッド。env で上書き可能）
const DATA_DIR =
  process.env.FACILITY_DATA_DIR ??
  'C:/Users/tmucs/AppData/Local/Temp/claude/C--Users-tmucs-Desktop-Antigravity/475a0a66-64ab-446c-a374-83ab5ce37f30/scratchpad/facility-data';

// 読み込み順（後勝ち。シードは同 slug の収集データで上書きされる）
const SOURCE_FILES = ['north.json', 'west-south.json', 'tokai-kansai.json', 'kanto.json'];

const OUT_DIR = resolve(__dirname, '..', 'src', 'content', 'facilities');

/** URL のホスト名を小文字化し www. を除いて返す（不正URLは null）。 */
function hostOf(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/** 文字列URL配列 → [{ label, url, official }]。official は officialUrl と同ホストか。 */
function normalizeSources(rawSources, officialUrl) {
  const officialHost = officialUrl ? hostOf(officialUrl) : null;
  const arr = Array.isArray(rawSources) ? rawSources : [];
  return arr.map((url) => {
    const h = hostOf(url);
    const official = officialHost != null && h != null && h === officialHost;
    return { label: official ? '公式サイト' : '参考情報', url, official };
  });
}

/** 収集レコードをスキーマ準拠の出力オブジェクトへ正規化する。 */
function normalize(src) {
  const officialUrl =
    typeof src.officialUrl === 'string' && src.officialUrl.length > 0 ? src.officialUrl : null;
  const lat = typeof src.lat === 'number' ? src.lat : null;
  const lng = typeof src.lng === 'number' ? src.lng : null;
  return {
    slug: src.slug,
    name: src.name,
    type: src.type,
    prefecture: src.prefecture,
    region: src.region,
    lat,
    lng,
    latlngApprox: src.latlngApprox === true,
    status: src.status ?? 'open',
    fees: Array.isArray(src.fees) ? src.fees : [],
    hours: src.hours ?? null,
    officialUrl,
    capybara: src.capybara ?? null,
    onsen: src.onsen ?? null,
    sources: normalizeSources(src.sources, officialUrl),
    lastVerified: src.lastVerified,
    detail: src.detail !== false,
  };
}

// --- 読み込み・結合（後勝ち） ---
const bySlug = new Map();
const perFile = [];
for (const file of SOURCE_FILES) {
  const path = join(DATA_DIR, file);
  const records = JSON.parse(readFileSync(path, 'utf8'));
  perFile.push({ file, count: records.length });
  for (const rec of records) {
    if (!rec.slug) throw new Error(`slug 欠落: ${file} 内の "${rec.name ?? '(no name)'}"`);
    bySlug.set(rec.slug, normalize(rec));
  }
}

// --- 書き出し（1施設1ファイル・2スペース） ---
const facilities = [...bySlug.values()];
for (const f of facilities) {
  const out = join(OUT_DIR, `${f.slug}.json`);
  writeFileSync(out, JSON.stringify(f, null, 2) + '\n', 'utf8');
}

// --- サマリ ---
const total = facilities.length;
const detail = facilities.filter((f) => f.detail).length;
const simple = total - detail;
const closed = facilities.filter((f) => f.status === 'closed').length;
const suspended = facilities.filter((f) => f.status === 'suspended').length;
const noCoords = facilities.filter((f) => f.lat === null || f.lng === null);
const noOfficial = facilities.filter((f) => f.officialUrl === null);
const onsenHas = facilities.filter((f) => f.onsen && f.onsen.has === true).length;
const byType = {};
for (const f of facilities) byType[f.type] = (byType[f.type] ?? 0) + 1;

const written = readdirSync(OUT_DIR).filter((n) => n.endsWith('.json')).length;

console.log('=== import-facilities サマリ ===');
console.log('入力ファイル:', perFile.map((p) => `${p.file}(${p.count})`).join(' / '));
console.log(`総数: ${total}（詳細 ${detail} / 簡易 ${simple}）`);
console.log(`closed: ${closed} / suspended: ${suspended}`);
console.log(`座標なし: ${noCoords.length} → ${noCoords.map((f) => f.slug).join(', ')}`);
console.log(`officialUrl なし: ${noOfficial.length} → ${noOfficial.map((f) => f.slug).join(', ')}`);
console.log(`温泉あり(onsen.has): ${onsenHas}`);
console.log('種別内訳:', JSON.stringify(byType));
console.log(`出力ディレクトリ内 .json 総数: ${written}`);
