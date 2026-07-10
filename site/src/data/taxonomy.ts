/**
 * 種別・地方のメタデータ（マップのピン色・凡例・詳細ページ表示に共用）。
 * ピンの色は「トークン色」をCSSで割り当てる方式（このファイルは pinClass 名だけ持つ）。
 * デザインガイドライン §5: アイコンは Phosphor、色は面積5%未満のアクセント体系に限定。
 */

export type FacilityType =
  | 'zoo'
  | 'aquarium'
  | 'cafe'
  | 'farm'
  | 'safari'
  | 'park'
  | 'theme_park'
  | 'indoor'
  | 'other';

export interface TypeMeta {
  /** 表示名 */
  label: string;
  /** Phosphor アイコン名 */
  icon: string;
  /** 地図ピンの色クラス（--pin-color をトークンから割り当てる） */
  pinClass: string;
}

/**
 * 種別 → メタ。ピン色はデザインガイドラインのトークンに割り当てる:
 *   zoo=--green / aquarium=--accent / cafe=--accent-strong / farm=--text-2
 * （spec §4.2 の「水族館=青」はトークン体系に青が無いため、ガイドラインのアクセント系で代替）
 *
 * P1 追加の5種は、既存4種と識別できるようトークン（＋トークン同士の color-mix）で配色する:
 *   safari=--live（朱） / park=green×accent（オリーブ） /
 *   theme_park=live×surface-deep（ダスティ・サーモン） / indoor=--text-1（濃焦げ茶） /
 *   other=--text-3（淡グレージュ）。実際の色は map の pin CSS で --pin-color に割当てる。
 */
export const TYPE_META: Record<FacilityType, TypeMeta> = {
  zoo: { label: '動物園', icon: 'ph:paw-print', pinClass: 'pin--zoo' },
  aquarium: { label: '水族館', icon: 'ph:fish-simple', pinClass: 'pin--aquarium' },
  cafe: { label: 'カフェ', icon: 'ph:coffee', pinClass: 'pin--cafe' },
  farm: { label: '牧場', icon: 'ph:barn', pinClass: 'pin--farm' },
  safari: { label: 'サファリパーク', icon: 'ph:jeep', pinClass: 'pin--safari' },
  park: { label: '公園', icon: 'ph:park', pinClass: 'pin--park' },
  theme_park: { label: 'レジャー・遊園地', icon: 'ph:balloon', pinClass: 'pin--themepark' },
  indoor: { label: '屋内ふれあい', icon: 'ph:storefront', pinClass: 'pin--indoor' },
  other: { label: 'その他', icon: 'ph:dots-three-circle', pinClass: 'pin--other' },
};

/** 未知の種別が来ても落ちないフォールバック付きアクセサ。 */
export function typeMeta(type: string): TypeMeta {
  return (
    (TYPE_META as Record<string, TypeMeta>)[type] ?? {
      label: type,
      icon: 'ph:map-pin',
      pinClass: 'pin--zoo',
    }
  );
}

/** 地方コード → 表示名。region は z.string で受けるため、未知コードはコードのまま表示する。 */
export const REGION_LABELS: Record<string, string> = {
  hokkaido: '北海道',
  tohoku: '東北',
  kanto: '関東',
  koshinetsu: '甲信越',
  hokuriku: '北陸',
  tokai: '東海',
  kansai: '関西',
  kinki: '近畿',
  chugoku: '中国',
  shikoku: '四国',
  kyushu: '九州',
  okinawa: '沖縄',
};

/** 地方セレクタの並び順（北→南）。未知コードはデータ出現順で末尾に付ける。 */
export const REGION_ORDER: string[] = [
  'hokkaido',
  'tohoku',
  'kanto',
  'koshinetsu',
  'hokuriku',
  'tokai',
  'kansai',
  'kinki',
  'chugoku',
  'shikoku',
  'kyushu',
  'okinawa',
];

export function regionLabel(region: string): string {
  return REGION_LABELS[region] ?? region;
}

/**
 * データに存在する地方コードを、既知の並び順→未知（出現順）で整列して返す。
 * 地方セレクタの選択肢生成に使う。
 */
export function sortRegions(regions: Iterable<string>): string[] {
  const present = Array.from(new Set(regions));
  const known = REGION_ORDER.filter((r) => present.includes(r));
  const unknown = present.filter((r) => !REGION_ORDER.includes(r));
  return [...known, ...unknown];
}
