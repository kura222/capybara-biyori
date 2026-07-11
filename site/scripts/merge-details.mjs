/**
 * 国内施設「詳細化」統合スクリプト（P1 → 詳細版）。
 *
 * 別エージェントが収集・検証した詳細JSON（detail-east / detail-mid / detail-west）を読み込み、
 * 各エントリを slug で既存の src/content/facilities/<slug>.json に**マージ**する。
 *
 * マージ規則:
 *   - 新データの値を優先する（`{ ...existing, ...incoming }`）。
 *   - ただし既存ファイルにあって新データに無いキー（live / affiliate / hasCafe / slug 等）は
 *     スプレッド順で自動的に保持される（新データが同キーを持たない限り上書きされない）。
 *   - capybara オブジェクト内に空文字キー ""（キー名が空文字）があれば除去する。
 *   - onsen に sourceUrl があり note が無い等の差異は新データをそのまま採用（収集側で検証済み）。
 *
 * 前提: 85件すべての slug に既存ファイルが存在する（存在しなければエラーで停止）。
 *
 * 実行: node scripts/merge-details.mjs
 * 収集データの場所は環境変数 DETAIL_DATA_DIR で上書き可。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 収集データの置き場所（セッションのスクラッチパッド。env で上書き可能）
const DATA_DIR =
  process.env.DETAIL_DATA_DIR ??
  'C:/Users/tmucs/AppData/Local/Temp/claude/C--Users-tmucs-Desktop-Antigravity/475a0a66-64ab-446c-a374-83ab5ce37f30/scratchpad/facility-data/v2';

const SOURCE_FILES = ['detail-east.json', 'detail-mid.json', 'detail-west.json'];

const OUT_DIR = resolve(__dirname, '..', 'src', 'content', 'facilities');

// 既存ファイルにあって新データに無い場合、必ず保持したいキー（監査ログ用）。
const PRESERVE_KEYS = ['live', 'affiliate', 'hasCafe', 'slug'];

/** capybara 内の空文字キー "" を除去した新オブジェクトを返す（無ければそのまま）。 */
function cleanCapybara(capybara) {
  if (!capybara || typeof capybara !== 'object') return capybara;
  if (!Object.prototype.hasOwnProperty.call(capybara, '')) return capybara;
  const { ['']: _removed, ...rest } = capybara;
  return rest;
}

// --- 読み込み・マージ ---
const perFile = [];
const merged = [];
const statusChanges = [];
const preservedLog = [];

for (const file of SOURCE_FILES) {
  const path = join(DATA_DIR, file);
  const records = JSON.parse(readFileSync(path, 'utf8'));
  perFile.push({ file, count: records.length });

  for (const incoming of records) {
    if (!incoming.slug) {
      throw new Error(`slug 欠落: ${file} 内の "${incoming.name ?? '(no name)'}"`);
    }
    const target = join(OUT_DIR, `${incoming.slug}.json`);
    if (!existsSync(target)) {
      throw new Error(`既存ファイルが見つかりません: ${incoming.slug}.json（${file}）`);
    }
    const existing = JSON.parse(readFileSync(target, 'utf8'));

    // 新データ優先でマージ（既存のみのキーは保持される）
    const out = { ...existing, ...incoming };

    // capybara の空文字キーを除去
    if (out.capybara) out.capybara = cleanCapybara(out.capybara);

    // status 変更を記録
    if (existing.status !== out.status) {
      statusChanges.push({ slug: out.slug, from: existing.status, to: out.status });
    }
    // 保持されたキーを記録（既存にあり新データに無いもの）
    const preserved = PRESERVE_KEYS.filter(
      (k) =>
        Object.prototype.hasOwnProperty.call(existing, k) &&
        !Object.prototype.hasOwnProperty.call(incoming, k),
    );
    if (preserved.length > 0) preservedLog.push({ slug: out.slug, keys: preserved });

    writeFileSync(target, JSON.stringify(out, null, 2) + '\n', 'utf8');
    merged.push(out);
  }
}

// --- サマリ ---
const all = readdirSync(OUT_DIR).filter((n) => n.endsWith('.json'));
let detailTrue = 0;
for (const n of all) {
  const d = JSON.parse(readFileSync(join(OUT_DIR, n), 'utf8'));
  if (d.detail === true) detailTrue++;
}

console.log('=== merge-details サマリ ===');
console.log('入力:', perFile.map((p) => `${p.file}(${p.count})`).join(' / '));
console.log(`マージ件数: ${merged.length}`);
console.log(`施設ファイル総数: ${all.length}`);
console.log(`detail:true 件数（全体）: ${detailTrue}`);
console.log(
  `status 変更: ${statusChanges.length}`,
  statusChanges.map((c) => `${c.slug}(${c.from}→${c.to})`).join(', '),
);
console.log(
  `live/affiliate/hasCafe/slug の保持が発生したファイル: ${preservedLog.length}`,
);
if (preservedLog.length > 0) {
  const keyCount = {};
  for (const p of preservedLog) for (const k of p.keys) keyCount[k] = (keyCount[k] ?? 0) + 1;
  console.log('  保持キー内訳:', JSON.stringify(keyCount));
}
