/**
 * サイト設定の一元管理（仕様 §8 / 要件 Q1 対応）
 *
 * 将来のドメイン移行は、この `SITE_URL` を 1 か所書き換えるだけで
 * canonical・OGP・sitemap 等がすべて追従する設計にしている。
 * 環境変数 `PUBLIC_SITE_URL` が指定されていればそれを優先する
 * （Cloudflare Pages のプレビュー環境などで上書きできるようにするため）。
 */

/** 本番サイトの絶対URL（末尾スラッシュなし）。ドメイン移行時はここだけ変更する。 */
export const SITE_URL: string = (
  import.meta.env?.PUBLIC_SITE_URL ?? 'https://capybara-biyori.pages.dev'
).replace(/\/+$/, '');

/**
 * ライブ状態JSON（仕様 §5）の取得先。
 * GitHub Actions が **data ブランチ** に生成・コミットした live-status.json を、
 * クライアントが raw.githubusercontent 経由で fetch する。
 *
 * - 既定は data ブランチの raw URL。GitHub 公開（P5）で `OWNER/REPO` を実値に差し替える
 *   （環境変数 `PUBLIC_LIVE_STATUS_URL` で上書き可能）。
 * - ローカル開発・公開前は remote が 404 になるため、`LIVE_STATUS_FALLBACK_URL`
 *   （`/data/live-status.json`＝check-live.mjs のローカル出力）へフォールバックする。
 */
export const LIVE_STATUS_URL: string =
  import.meta.env?.PUBLIC_LIVE_STATUS_URL ??
  'https://raw.githubusercontent.com/OWNER/capybara-biyori/data/live-status.json';

/** ローカル開発時のフォールバック（Astro が public/data/ を /data/ として配信） */
export const LIVE_STATUS_FALLBACK_URL = '/data/live-status.json';

/** サイト全体のメタ情報 */
export const SITE = {
  /** 正式サイト名 */
  name: 'カピバラ日和',
  /** 読み仮名 */
  nameKana: 'かぴばらびより',
  /** 英字表記（OGP等の補助用） */
  nameEn: 'Capybara Biyori',
  /** 既定の説明文（トップページや og:description の初期値） */
  description:
    'カピバラのライブ配信・全国の会える施設マップ・温泉カレンダーをまとめた、カピバラ好きのためのポータルサイト。今すぐ見たい・会いに行きたいを1か所で。',
  /** 言語コード（html lang / og:locale 用） */
  lang: 'ja',
  locale: 'ja_JP',
  /** 既定のOGP画像（サイトルート相対。実画像はP4で差し替え） */
  defaultOgImage: '/ogp-default.png',
  /** 運営者表記 */
  author: 'カピバラ日和 運営',
} as const;

/**
 * グローバルナビゲーション（ヘッダー）。
 * 文言は「目的起点」（すみだ水族館式・デザインガイドライン §9）。
 * icon は Phosphor Icons 名（絵文字全廃・§5）。
 */
export const NAV_ITEMS = [
  { label: '会いに行く', href: '/map/', icon: 'ph:map-trifold' },
  { label: '温泉ごよみ', href: '/onsen/', icon: 'ph:calendar-dots' },
  { label: 'よみもの', href: '/articles/', icon: 'ph:notebook' },
] as const;

/** フッターのポリシー・情報リンク */
export const FOOTER_LINKS = [
  { label: 'サイトについて', href: '/about/' },
  { label: 'プライバシーポリシー', href: '/privacy/' },
] as const;

/**
 * 相対パスから、SITE_URL を基点とした絶対URLを組み立てる。
 * canonical / og:url / sitemap などで使用する。
 */
export function absoluteUrl(path: string): string {
  // 先頭スラッシュを保証してから結合（二重スラッシュを防ぐ）
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}
