/**
 * コンテンツコレクション定義（Astro Content Layer）。
 * 仕様 §6 の facilities スキーマに準拠し、P1 で以下の 2 フィールドを追加している:
 *   - latlngApprox: 座標が概算値かどうか（地図・詳細で「およその位置」と明示するため）
 *   - sources[]:    情報の出典（鮮度・信頼性の証明。公式/その他を区別）
 *
 * データ収集は別エージェントが継続中のため、
 * **必須項目を最小限に絞り、未確認項目は null / 既定値を許容する**寛容な設計にしている
 * （部分的なデータでもビルドが通り、後から統合できるようにする）。
 */
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** 料金の1行（例: 大人 / 2,700円） */
const feeSchema = z.object({
  label: z.string(),
  price: z.string(),
});

/** カピバラとのふれあい情報。未確認は null。 */
const capybaraSchema = z.object({
  fureai: z.boolean().nullable().default(null), // ふれあい可否
  esayari: z.boolean().nullable().default(null), // 餌やり可否
  note: z.string().nullable().default(null), // 見どころ・頭数など
});

/** 温泉（露天風呂・変わり湯）イベント情報。単発イベントは start/end を null にできる。 */
const onsenSchema = z.object({
  has: z.boolean().default(false), // 温泉イベントの有無（フィルタ「温泉あり」の判定）
  seasonLabel: z.string().nullable().default(null), // 例: 2025-26シーズン
  start: z.string().nullable().default(null), // 開催開始 YYYY-MM-DD
  end: z.string().nullable().default(null), // 開催終了 YYYY-MM-DD
  times: z.string().nullable().default(null), // 実施時間帯
  note: z.string().nullable().default(null), // 補足（出典の但し書き・変わり湯など）
  sourceUrl: z.string().url().nullable().default(null), // 期間の出典URL
});

/** 出典（鮮度の証明）。official=公式サイト系。 */
const sourceSchema = z.object({
  label: z.string().default('公式サイト'),
  url: z.string().url(),
  official: z.boolean().default(false),
});

const facilities = defineCollection({
  // ファイル名（拡張子なし）が施設スラッグ = URL になる（例: izu-shaboten.json → /spots/izu-shaboten/）
  loader: glob({ pattern: '**/*.json', base: './src/content/facilities' }),
  schema: z.object({
    // slug は spec §6 互換のため任意で保持（URL には entry.id=ファイル名を使う）
    slug: z.string().optional(),
    name: z.string(),
    // P1: 収集データに合わせ種別を拡張（safari=サファリパーク / park=公園 /
    // theme_park=レジャー・遊園地 / indoor=屋内ふれあい / other=その他）。
    type: z.enum(['zoo', 'aquarium', 'cafe', 'farm', 'safari', 'park', 'theme_park', 'indoor', 'other']),
    prefecture: z.string(),
    // region は地方コード。未知コードも受け入れる（表示名は taxonomy 側で解決）。
    region: z.string(),
    // 座標は nullable。簡易データで未確認の施設は null（地図にピンを打たずカード一覧のみ）。
    lat: z.number().nullable().default(null),
    lng: z.number().nullable().default(null),
    latlngApprox: z.boolean().default(false),
    status: z.enum(['open', 'closed', 'suspended']).default('open'),
    fees: z.array(feeSchema).default([]),
    hours: z.string().nullable().default(null),
    // 公式サイトが未確認の施設は null（詳細・地図でリンクを非表示にする）。
    officialUrl: z.string().url().nullable().default(null),
    // 施設内にカピバラカフェ等がある場合の任意フラグ（フィルタ「カフェ」は type==='cafe' || hasCafe）
    hasCafe: z.boolean().default(false),
    capybara: capybaraSchema.nullable().default(null),
    onsen: onsenSchema.nullable().default(null),
    live: z.object({ channelSlug: z.string() }).nullable().default(null),
    // 提携後にURLを投入。空文字のうちは収益導線を出さない（仕様 §9）。
    affiliate: z
      .object({
        asoview: z.string().default(''),
        rakutenTravel: z.string().default(''),
        jalan: z.string().default(''),
      })
      .default({}),
    sources: z.array(sourceSchema).default([]),
    lastVerified: z.string(), // 情報最終確認日 YYYY-MM-DD
    detail: z.boolean().default(true), // false=簡易カード（名称+公式リンクのみ・詳細ページ非生成）
  }),
});

/**
 * 記事コレクション（Markdown・仕様 §4.5 / P4）。
 * ファイル名（拡張子なし）が記事スラッグ = URL になる（例: onsen-season-guide.md → /articles/onsen-season-guide/）。
 * 本文は Markdown（目次は render() が返す headings から自動生成する）。
 */
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // 公開日・更新日（YYYY-MM-DD を Date に変換）。updatedDate は任意。
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    // カテゴリタグ（一覧の絞り込み表示・記事メタに使用）
    tags: z.array(z.string()).default([]),
    // 関連施設のスラッグ（src/content/facilities のファイル名）。詳細ページ末尾のカードで解決する。
    relatedSpots: z.array(z.string()).default([]),
    // 一覧・ヒーローのプレースホルダーアイコン（Phosphor 名・絵文字全廃 §5）
    icon: z.string().default('ph:notebook'),
    // 下書き（true でビルド対象から除外）
    draft: z.boolean().default(false),
  }),
});

export const collections = { facilities, articles };
