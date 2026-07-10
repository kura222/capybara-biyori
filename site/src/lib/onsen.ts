/**
 * 温泉イベントの開催状況を、基準日から判定する。
 * ビルド時（frontmatter）と閲覧時（クライアントスクリプト）の両方で使い、
 * 静的ビルド日と閲覧日のズレをクライアント側で補正する。
 */

export type OnsenStatus = 'active' | 'soon' | 'upcoming' | 'ended' | 'unknown';

export interface OnsenStatusResult {
  status: OnsenStatus;
  /** バッジ表示ラベル */
  label: string;
  /** Badge の配色に対応（ok=緑 / warn=橙 / neutral=灰） */
  badge: 'ok' | 'warn' | 'neutral';
}

const DAY = 24 * 60 * 60 * 1000;
/** 「まもなく終了」を出す残日数のしきい値（2週間前から） */
const SOON_DAYS = 14;

/** YYYY-MM-DD を 00:00 のローカル日付として解釈する（不正値は null）。 */
function parseYmd(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * 開催状況を判定する。
 * start/end のいずれかが欠ける（単発イベント等）場合は 'unknown' を返し、
 * 呼び出し側で自動バッジを出さない判断ができるようにする。
 */
export function getOnsenStatus(
  start: string | null | undefined,
  end: string | null | undefined,
  now: Date = new Date(),
): OnsenStatusResult {
  const s = parseYmd(start);
  const e = parseYmd(end);
  if (!s || !e) {
    return { status: 'unknown', label: '開催情報あり', badge: 'neutral' };
  }
  // 当日の 00:00 に丸めて比較（時刻のブレを無視）
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (today < s.getTime()) {
    return { status: 'upcoming', label: '開催前', badge: 'neutral' };
  }
  if (today > e.getTime()) {
    return { status: 'ended', label: '今季終了', badge: 'neutral' };
  }
  if (e.getTime() - today <= SOON_DAYS * DAY) {
    return { status: 'soon', label: 'まもなく終了', badge: 'warn' };
  }
  return { status: 'active', label: '開催中', badge: 'ok' };
}
