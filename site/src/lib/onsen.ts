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

// ============================================================
// 温泉カレンダー（/onsen/）用の拡張ロジック（P2）
// ------------------------------------------------------------
// データは3タイプに分かれるため、施設ごとに分類し、
//   A: dated     … 開催期間（start）が判明 → 横棒タイムライン
//   B: permanent … 通年・常設           → 「いつでも入れる湯」
//   C: pending   … 今季日程が未確定       → 「今季の発表待ち」
// バッジは閲覧時の日付から判定し、静的ビルド日とのズレをクライアントで補正する。
// ============================================================

/** カレンダーで扱う温泉フィールドの最小形（施設データの onsen 部分と互換）。 */
export interface OnsenInput {
  has?: boolean;
  seasonLabel?: string | null;
  start?: string | null;
  end?: string | null;
  times?: string | null;
  note?: string | null;
  sourceUrl?: string | null;
}

/** 3分類。 */
export type OnsenCategory = 'permanent' | 'dated' | 'pending';

/** 表示軸の月（11月〜翌4月・等幅6コマ）。月ラベル描画に使う。 */
export const TIMELINE_MONTHS = [11, 12, 1, 2, 3, 4] as const;

/** 「終了未定」バーの右端フェード位置の基準（3月末）。 */
const OPEN_END_MONTH_DAY = { month: 3, day: 31 } as const;
/** 終了後に「昨季の実績（参考）」へ倒す猶予（1シーズン超＝約7か月）。 */
const REFERENCE_DAYS = 210;
/** 終了日未定でも「シーズンは終わった」とみなす開始からの経過（約5.5か月）。 */
const SEASON_MAX_DAYS = 165;

/** seasonLabel に「通年」「常設」を含むか（＝季節に関係なく入浴が見られる）。 */
export function isPermanentOnsen(o: OnsenInput): boolean {
  return /通年|常設/.test(o.seasonLabel ?? '');
}

/**
 * 温泉イベントを3分類する。
 * - permanent: 通年・常設（オフシーズンでも見られる主役）
 * - dated:     開催期間（start）が判明（過去シーズンの実績値を含む）
 * - pending:   日付未確定（例年冬季だが今季日程が未発表 等）
 */
export function classifyOnsen(o: OnsenInput): OnsenCategory {
  if (isPermanentOnsen(o)) return 'permanent';
  if (parseYmd(o.start)) return 'dated';
  return 'pending';
}

/** 温泉シーズン（表示軸=11月〜4月）の期間内か。今日位置線・並び順の判定に使う。 */
export function isOnsenSeason(now: Date = new Date()): boolean {
  const m = now.getMonth() + 1;
  return m >= 11 || m <= 4;
}

export type OnsenCalStatus =
  | 'permanent'
  | 'active'
  | 'soon-end'
  | 'soon-start'
  | 'upcoming'
  | 'ended'
  | 'reference'
  | 'pending';

export interface OnsenCalResult {
  status: OnsenCalStatus;
  /** バッジ表示ラベル */
  label: string;
  /** バッジ配色（ok=緑 / warn=橙 / neutral=灰） */
  badge: 'ok' | 'warn' | 'neutral';
}

/** 当日00:00の time 値。 */
function midnight(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * カレンダー用の開催状況。
 * getOnsenStatus を「通年」「発表待ち」「昨季の実績（参考値）」まで拡張したもの。
 * 4状態のテスト観点: 開催中 / まもなく開始・終了 / 今季終了 / 発表待ち。
 */
export function getOnsenCalStatus(o: OnsenInput, now: Date = new Date()): OnsenCalResult {
  if (isPermanentOnsen(o)) {
    return { status: 'permanent', label: '通年で楽しめる', badge: 'ok' };
  }
  const s = parseYmd(o.start);
  if (!s) {
    return { status: 'pending', label: '今季の発表待ち', badge: 'neutral' };
  }
  const e = parseYmd(o.end);
  const today = midnight(now);
  const labelRef = /実績/.test(o.seasonLabel ?? '');

  // 開始前
  if (today < s.getTime()) {
    if (labelRef) return { status: 'reference', label: '昨季の実績', badge: 'neutral' };
    if (s.getTime() - today <= SOON_DAYS * DAY) {
      return { status: 'soon-start', label: 'まもなく開始', badge: 'warn' };
    }
    return { status: 'upcoming', label: 'シーズン待ち', badge: 'neutral' };
  }

  // 終了日が未定（開始済み）: 経過が長ければ終了とみなす
  if (!e) {
    if (today - s.getTime() > SEASON_MAX_DAYS * DAY) {
      return labelRef
        ? { status: 'reference', label: '昨季の実績', badge: 'neutral' }
        : { status: 'ended', label: '今季終了', badge: 'neutral' };
    }
    return { status: 'active', label: '開催中', badge: 'ok' };
  }

  // 終了後
  if (today > e.getTime()) {
    const far = today - e.getTime() > REFERENCE_DAYS * DAY;
    if (labelRef || far) return { status: 'reference', label: '昨季の実績', badge: 'neutral' };
    return { status: 'ended', label: '今季終了', badge: 'neutral' };
  }

  // 開催中
  if (e.getTime() - today <= SOON_DAYS * DAY) {
    return { status: 'soon-end', label: 'まもなく終了', badge: 'warn' };
  }
  return { status: 'active', label: '開催中', badge: 'ok' };
}

// ---- タイムライン軸の座標計算（各月=等幅1/6） ----

const MONTH_DAYS: Record<number, number> = {
  1: 31,
  2: 29, // 閏を含む近似（軸の見た目にのみ影響）
  3: 31,
  4: 30,
  11: 30,
  12: 31,
};

/** 月(1-12)→軸内インデックス（0=11月 … 5=4月）。範囲外は負値/6以上。 */
function seasonMonthIndex(m: number): number {
  if (m >= 11) return m - 11; // 11→0, 12→1
  if (m <= 4) return m + 1; // 1→2 … 4→5
  return m <= 7 ? -1 : 6; // 5-7=軸より前 / 8-10=軸より後（次シーズン前）
}

/** 日付を軸上の位置(0..1)へ。11/1=0、翌5/1=1。範囲外はクランプ。 */
export function seasonPosition(date: Date): number {
  const m = date.getMonth() + 1;
  const idx = seasonMonthIndex(m);
  if (idx < 0) return 0;
  if (idx >= 6) return 1;
  const dim = MONTH_DAYS[m] ?? 30;
  const frac = Math.min(1, (date.getDate() - 1) / dim);
  return Math.min(1, (idx + frac) / 6);
}

export interface OnsenBar {
  /** 左端位置 0..1 */
  left: number;
  /** 右端位置 0..1 */
  right: number;
  /** 終了未定（右端をフェード表現） */
  openEnd: boolean;
  /** 単日イベント（点として描画） */
  singleDay: boolean;
}

/** dated 施設の開催バー座標。start が無ければ null。 */
export function onsenBar(o: OnsenInput): OnsenBar | null {
  const s = parseYmd(o.start);
  if (!s) return null;
  const left = seasonPosition(s);
  const e = parseYmd(o.end);
  if (!e) {
    // 終了未定: 3月末までフェードで伸ばす
    const right = seasonPosition(new Date(2001, OPEN_END_MONTH_DAY.month - 1, OPEN_END_MONTH_DAY.day));
    return { left, right: Math.max(right, left), openEnd: true, singleDay: false };
  }
  const singleDay = (o.start ?? '') === (o.end ?? '');
  const right = Math.max(seasonPosition(e), left);
  return { left, right, openEnd: false, singleDay };
}

/** 今日の軸上位置(0..1)。シーズン外は null（縦線を出さない）。 */
export function todayPosition(now: Date = new Date()): number | null {
  if (!isOnsenSeason(now)) return null;
  return seasonPosition(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}
