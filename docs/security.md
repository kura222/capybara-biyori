# カピバラ日和 セキュリティ・リスク設計書

- 版: v1.0（2026-07-10 ユーザー指示「データを抜かれる・請求がくる・攻撃される・裁判になるものを極力避ける」を受け作成）
- 位置づけ: 全フェーズの実装・運用はこの文書に従う。違反する実装は差し戻し

---

## 1. 費用リスク（請求がくる事故）→ 構造的にゼロ化

| リスク | 対策 | 状態 |
|---|---|---|
| クラウドの従量課金事故 | **課金され得るサービスを一切使わない**。Cloudflare Pages無料枠（超過課金なし・帯域無制限）／GitHub公開リポジトリ（Actions無料無制限）。クレジットカード登録を要する構成を採らない | ✅設計済み |
| YouTube APIの課金 | YouTube Data API v3は**完全無料**（超過時は課金でなくエラー）。使用量は無料枠の約1%以下 | ✅ |
| APIキー漏洩による他API悪用 | キーは**YouTube Data API v3のみに制限済み**（Google Cloud側で確認済み）→ 漏洩しても課金APIには使えない | ✅確認済み |
| キーの露出面 | キーは**サーバーサイド（GitHub Actions secrets）のみ**で使用。サイトのHTML/JSには一切埋め込まない（クライアントは静的JSONを読むだけ） | ✅設計済み |
| キーの衛生管理 | 本キーは開発中にローカル・ツール経由で取り扱ったため、**P5公開時に再生成（ローテーション）してからActions secretsに登録**する | 🔲P5で実施 |

## 2. データを抜かれるリスク → 抜かれるデータを持たない

- **ユーザーデータを一切収集・保存しない**: ログインなし・DBなし・フォームなし（問い合わせは外部のGoogleフォーム）・コメントなし
- アクセス解析は**Cloudflare Web Analytics（Cookieレス）**のみ。個人情報を扱わないためGDPR/個情法上のリスクが最小
- 静的サイトのためサーバー侵入で抜かれる「中身」が存在しない
- **公開リポジトリ化（P5）前のシークレットスキャン必須**: git全履歴に APIキー・トークンが無いことを確認してからpublicにする（チェックリスト§6）

## 3. 攻撃リスク（改ざん・XSS・サプライチェーン）

| ベクタ | 対策 |
|---|---|
| **XSS（最重要）**: live-status.json に入る動画タイトル・チャンネル名は**外部由来の文字列**（悪意あるタイトルを付けた配信を監視対象が流す可能性） | クライアントでのDOM挿入は **textContent / setAttribute のみ**。innerHTML への外部文字列連結を禁止。実装検証項目に含める |
| 依存パッケージ | 依存は最小構成（astro/leaflet/astro-icon）を維持・`npm audit` 0を保つ。P5でGitHub Dependabot alertsを有効化 |
| GitHub Actions | workflowの `permissions` を最小化（contents: write のみ）。サードパーティActionはバージョンをSHA/タグで固定。secretsをログにechoしない |
| 配信ヘッダ | Cloudflare Pages の `_headers` でセキュリティヘッダを付与: X-Content-Type-Options: nosniff / Referrer-Policy: strict-origin-when-cross-origin / Permissions-Policy（不要権限の無効化）/ CSP（frame-srcはyoutube-nocookie.com等に限定） |
| サイト改ざん | デプロイ経路はGitHub→Cloudflare Pagesのみ。両アカウントの**2FA有効化**（P5チェックリスト） |

## 4. 法的リスク（裁判になり得るもの）→ 「公式の仕組みの内側」だけを使う

| リスク | ルール |
|---|---|
| 動画の無断転載 | **YouTube公式iframe埋め込みのみ**使用（配信者が埋め込み許可した動画だけ・playable_in_embedを実測確認済み）。ダウンロード・再配信・録画は一切しない |
| **自前HLSの直接埋め込み禁止** | モスクワ動物園・Bella Állatpark等の自前配信は、m3u8のURLが取得できても**絶対に埋め込まない**（転載＝著作権・規約違反リスク）。**外部リンク紹介のみ** |
| 有料サービスの迂回 | zoolife.tv等のサブスク配信の無断表示はしない（リンク紹介のみ） |
| YouTube規約 | 埋め込みプレイヤーへのオーバーレイ禁止・再生をゲート化しない・埋め込みだけのページに広告を置かない（全ページに独自コンテンツ併載）— design-guidelines/spec準拠で実装済み |
| 施設情報の著作権 | 施設DBは**一次情報（公式サイト）から事実のみを自分の言葉で**記載。他サイトの記事・写真の転載なし。出典URL・最終確認日を明示 |
| 名誉・正確性 | 閉園・休止情報は公式発表/報道ベースのみ。推測で「閉園」と書かない（「発表待ち」「要確認」表記を使う） |
| 削除依頼への対応 | aboutページに**掲載ポリシーと削除依頼窓口**を明記（P4）。施設・配信者から削除依頼があれば速やかに対応する運用 |
| 広告表記 | 全アフィリエイトページに「PRを含みます」表記（景表法ステマ規制対応・実装済み）。プライバシーポリシーはP4で整備 |
| 肖像・プライバシー | 埋め込むのは動物のカメラのみ。人物が主体の配信は扱わない |

## 5. 実装済み事項の確認結果（2026-07-10時点）

- ✅ APIキー: YouTube Data API v3制限済み・クライアント非埋め込み設計・.envはgitignore確認済み
- ✅ 動画: 全て公式YouTube埋め込み（youtube-nocookie.com使用）・embedOk実測
- ✅ ユーザーデータ: 収集ゼロ設計
- 🔲 XSS対策の実装検証（P3.5検収時に確認）
- 🔲 `_headers`・workflow permissions最小化（P3.5/P5）
- 🔲 P5チェックリスト: キー再生成→secrets登録／git履歴シークレットスキャン／2FA確認／Dependabot有効化

## 6. P5公開前セキュリティチェックリスト

1. git全履歴のシークレットスキャン（AIza・token・secret等のパターンgrep）→ ゼロ確認後にpublic化
2. YouTube APIキーを**再生成**し、新キーをGitHub Actions secretsにのみ登録（.envも更新）
3. GitHub・Cloudflareアカウントの2FA有効化確認
4. Dependabot alerts有効化・`npm audit` 0確認
5. `_headers` の本番動作確認（securityheaders.com等で採点）
6. Actions workflowのpermissions・バージョン固定の最終確認
