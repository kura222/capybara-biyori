/**
 * 既定OGP画像（1200×630）の生成スクリプト（仕様 §8）。
 * デザインガイドラインのトークン（生成り地・明朝ロゴ・マスコット・湯けむり線）でSVGを組み、
 * sharp で public/ogp-default.png に書き出す。AI生成画像は使わず、自作SVGをラスタライズする。
 *
 * 実行: node scripts/gen-ogp.mjs
 * フォント: 明朝は Yu Mincho（Windows 同梱）。sharp(librsvg) が system font を解決する。
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, '../public/ogp-default.png');

// デザイントークン（global.css §2 と一致）
const BG = '#F7F2E9';
const SURFACE_DEEP = '#EAE0D0';
const TEXT1 = '#3A2E22';
const TEXT2 = '#6E5F4E';
const LINE_STRONG = '#C9B99F';
const ACCENT = '#C9682F';
const ACCENT_STRONG = '#A85320';
const ACCENT_INK = '#9A4A1B';
const MUZZLE = '#E8C0A8';
const EYE = '#5C2E12';

const mincho = 'Yu Mincho, YuMincho, MS Mincho, serif';
const latin = 'Georgia, serif';

// マスコット（Mascot.astro のシェイプを OGP 用に配置。0..64 → transform で拡大配置）
const mascot = `
  <g transform="translate(820,158) scale(4.7)">
    <g stroke="${LINE_STRONG}" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.85">
      <path d="M22 12c-2-2 2-3.2 0-5.2" />
      <path d="M32 9.5c-2-2 2-3.2 0-5.2" />
      <path d="M42 12c-2-2 2-3.2 0-5.2" />
    </g>
    <circle cx="18" cy="22" r="5.4" fill="${ACCENT_STRONG}" />
    <circle cx="46" cy="22" r="5.4" fill="${ACCENT_STRONG}" />
    <rect x="12" y="18" width="40" height="34" rx="16" fill="${ACCENT}" />
    <rect x="20" y="36" width="24" height="16" rx="7" fill="${MUZZLE}" />
    <circle cx="25" cy="31" r="2.5" fill="${EYE}" />
    <circle cx="39" cy="31" r="2.5" fill="${EYE}" />
    <circle cx="28.5" cy="44" r="1.7" fill="${EYE}" />
    <circle cx="35.5" cy="44" r="1.7" fill="${EYE}" />
  </g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}" />
  <!-- 下部の生成り強調帯 -->
  <rect x="0" y="556" width="1200" height="74" fill="${SURFACE_DEEP}" />
  <!-- 内側のヘアライン枠（罫線・影は使わない） -->
  <rect x="40" y="40" width="1120" height="550" fill="none" stroke="${LINE_STRONG}" stroke-width="1.5" rx="18" />

  <!-- 欧文小ラベル（Fraunces の代替として serif・字間広め） -->
  <text x="96" y="150" font-family="${latin}" font-size="26" letter-spacing="7" fill="${ACCENT_INK}">CAPYBARA BIYORI</text>
  <!-- アクセントの短い罫線 -->
  <rect x="96" y="172" width="54" height="3" rx="1.5" fill="${ACCENT}" />

  <!-- 明朝ワードマーク -->
  <text x="92" y="320" font-family="${mincho}" font-weight="700" font-size="116" fill="${TEXT1}">カピバラ日和</text>

  <!-- タグライン -->
  <text x="98" y="400" font-family="${mincho}" font-size="40" fill="${TEXT2}">今日は、カピバラ日和。</text>

  <!-- 説明 -->
  <text x="98" y="470" font-family="${mincho}" font-size="27" fill="${TEXT2}">カピバラのライブ配信・全国の会える施設・温泉ごよみ</text>

  ${mascot}

  <!-- 下部帯の中の URL 表記 -->
  <text x="96" y="601" font-family="${latin}" font-size="22" letter-spacing="2" fill="${ACCENT_INK}">capybara-biyori.pages.dev</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log('wrote', out);
