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
    type: z.enum(['zoo', 'aquarium', 'cafe', 'farm']),
    prefecture: z.string(),
    // region は地方コード。未知コードも受け入れる（表示名は taxonomy 側で解決）。
    region: z.string(),
    lat: z.number(),
    lng: z.number(),
    latlngApprox: z.boolean().default(false),
    status: z.enum(['open', 'closed', 'suspended']).default('open'),
    fees: z.array(feeSchema).default([]),
    hours: z.string().nullable().default(null),
    officialUrl: z.string().url(),
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

export const collections = { facilities };
