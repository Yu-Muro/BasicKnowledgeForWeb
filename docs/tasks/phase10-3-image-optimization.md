# Phase 10-3: 画像最適化（Cloudflare Images Transformations）

## 対象

- `apps/backend/src/index.ts`（`/assets/*` ハンドラ）
- `apps/frontend`（画像表示箇所: shop / others / events の一覧・詳細）
- Cloudflare ダッシュボード（ゾーンの Image Transformations 有効化）
- `docs/pages/07-events.md` / `08-shop.md` / `13-others.md`

## 背景・目的

現状、R2 の画像は `apps/backend/src/index.ts` の `/assets/*` で **無加工配信**され、
frontend は `next/image` を `unoptimized` で使用している（`components/TapToZoomImage.tsx`）。
不足しているのは最適化（loader / 変換配信）であり、`next/image` 導入そのものではない。shop / programs / others は画像が多く、
**会場のモバイル回線**では転送量・表示速度が課題になりやすい。

Cloudflare Images の **Transformations** で WebP/AVIF 変換とサイズ最適化を行い、体験を改善する。

## 方針（無料枠優先）

- R2（Images 外保存）の画像変換は **Free プランで月 5,000 ユニーク変換まで無料**。
- 実装は `fetch` の `cf.image` オプション（または URL インターフェース）を用いる。
  - ※ Images **バインディング**版は Images Paid プランが必要なため、本タスクでは採用しない。
- 参照: https://developers.cloudflare.com/images/optimization/transformations/

## 実装順序

1. Backend 実装（変換対応配信）
2. Backend テスト
3. Frontend 実装（サムネ/詳細の出し分け）
4. Frontend テスト

## 実装内容

1. ゾーンで Image Transformations を有効化する。
2. backend の `/assets/*` を変換対応にする。`width` / `quality` 等のクエリを受け取り、
   `fetch(originalUrl, { cf: { image: { width, quality, format } } })` 経由で配信する。既存の長期 `Cache-Control` は維持する。
   - **自己ループ回避（必須）:** `originalUrl` は変換ハンドラ自身の `/assets/*` を指さないようにする。
     R2 のオリジン（バケット公開 URL 等）や `/assets/*` とは別の「未変換オリジン」パスから取得する。
     公式は同一パスへの自己 `fetch` による無限ループを警告している。保険として、リクエストの `Via` に
     `image-resizing` が含まれる（リサイズ Worker からの再入）場合は変換せず素通しさせる。
   - **フォーマットは `Accept` ヘッダーで判定する:** カスタム Worker の `cf.image` では `format: 'auto'` は
     自動ネゴシエートしない。`Accept` を読み、`image/avif` なら `avif`、`image/webp` なら `webp` を設定する
     （いずれも無ければ元フォーマット）。
3. 用途別の `width` プリセット（例: `thumbnail` / `card` / `large`）を定義し、許可値以外は拒否または既定値にフォールバックする。
4. **変換失敗時のフォールバックは Worker 内でレスポンスを検査して行う。** `fetch` の `cf.image` 経由では
   `onerror=redirect` は使えない（URL インターフェース専用オプション）。変換レスポンスが `ok` / `redirected`
   でなければ未変換の原画像を返す（`Response.redirect(originalUrl, 307)` もしくは原画像を `fetch`）。
   これにより変換失敗・上限超過（`9422`）時も画像が表示される。
5. frontend: 一覧はサムネ、詳細は大サイズを出し分ける（`srcset` / `sizes` を付与）。

## このフェーズでやらないこと

- Images Paid 前提の機能（Images ストレージ・Images バインディング）
- `next/image` への全面移行
- 動画（Stream / Media Transformations）

## 注意・コスト

- Free 枠は **月 5,000 ユニーク変換**。超過すると新規変換は `9422` エラーになるため、上記の Worker 内フォールバック（レスポンス検査 → 原画像）で表示を維持する。
- 変換のバリエーション（width × format）を増やしすぎるとユニーク数が増える。プリセットを絞る。
- 規模拡大時は Images Paid を検討する。

## テスト

### Backend

- `Accept: image/avif` / `image/webp` に応じて出力フォーマット（`Content-Type`）が切り替わり、サイズが変化する
- 不正/未許可パラメータで既定値にフォールバックする、または原画像が返る
- 変換ハンドラが自分自身を fetch して無限ループしない（`Via` ガード / 別オリジン取得を検証）
- 既存の無加工配信パスが回帰しない

### Frontend

- 一覧でサムネ URL（小さい `width`）が生成される
- 詳細で大サイズが表示される
- 画像未設定/変換失敗時にレイアウトが崩れない

## 完了条件

- 画像が WebP/AVIF・用途別サイズで配信される
- 変換失敗・上限超過時に原画像へフォールバックする
- `apps/backend` / `apps/frontend` の `type-check`, `test`, `lint` が通る
- `docs/pages` の events / shop / others が本対応に追従している
