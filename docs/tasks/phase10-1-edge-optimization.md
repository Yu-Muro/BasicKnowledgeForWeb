# Phase 10-1: エッジ最適化（Hyperdrive キャッシュ + Smart Placement）

## 対象

- `apps/backend/wrangler.jsonc`（`placement` 設定）
- Hyperdrive 設定（Cloudflare ダッシュボード / `wrangler hyperdrive`）
- `apps/backend/src/infrastructure/repositories/**`（`NOW()` 等を含む GET クエリの調整）
- `docs/implementation-plan.md`（キャッシュ方針の追記）

## 目的

読み取り中心のコンテンツ GET API（timetable / rooms / programs / shop-items / other-items / search）の
レイテンシを、**コード変更を最小限**に抑えつつ削減する。設定中心で低リスク。

## 実装順序

1. Backend 設定（Hyperdrive キャッシュ確認・Smart Placement）
2. dev で計測
3. （必要なら）キャッシュ不可クエリの調整
4. テスト（既存 Feature テストの回帰確認）

## 実装内容

### A. Hyperdrive クエリキャッシュ

1. 現行 Hyperdrive 設定（dev/prod）でキャッシュが有効か、TTL がどうなっているかを確認する（ダッシュボード or `wrangler hyperdrive`）。
2. `max_age` / `stale_while_revalidate` をコンテンツ更新頻度に合わせて調整する（例: `max_age` 60 秒程度から開始し、運用で調整）。
3. **キャッシュ不可クエリの是正**: `NOW()` / `CURRENT_TIMESTAMP` / `CURRENT_DATE` 等の STABLE/VOLATILE 関数を含む GET クエリはキャッシュ対象外（2026-02 仕様）。期間判定はアプリ側で値を算出し、パラメータ（`WHERE ... > $1`）として渡す形にリポジトリ実装を修正してキャッシュ可能化する。
   - 参照: https://developers.cloudflare.com/hyperdrive/concepts/query-caching/

### B. Smart Placement

4. `apps/backend/wrangler.jsonc` に `placement` を追加する（dev/prod 両方）。どちらか一方を採用:
   - 自動: `"placement": { "mode": "smart" }`
   - 明示（DB と同一リージョン固定。2026-01 追加）: `"placement": { "region": "aws:ap-southeast-1" }`
5. dev で Observability（traces）によりレイテンシを計測し、改善が確認できたら prod に反映する。

## このフェーズでやらないこと

- HTTP レベル（Cache API）でのコンテンツ API キャッシュ（access_token によるアクセス制御があるため、別途キー設計を要検討）
- CockroachDB から他 DB への移行
- アプリ側のアプリケーションキャッシュ層の新設

## テスト

- 既存の Feature / 各層ユニットテストが緑のままであること
- キャッシュ化対象としたクエリが `NOW()` 等の STABLE/VOLATILE 関数に依存しない形に変更されていること（リポジトリ単体テストで確認）
- 機能の回帰がないこと
- ※ キャッシュ命中・レイテンシ改善自体はインフラ計測（自動テスト対象外）。dev の Observability で確認する。

## コスト

**無料**（設定変更が中心）。

## 注意

- Hyperdrive は接続確立を DB 近傍で行うため、Smart Placement の効果は「1 リクエストで複数回 DB 往復する処理」に依存する。まず dev で計測し、効果が出るルートで採用する。

## 完了条件

- `placement` 設定が dev/prod に入っている
- Hyperdrive キャッシュ方針（TTL・キャッシュ不可クエリの扱い）が明文化されている
- dev 計測でレイテンシ改善（または無影響）を確認済み
- `apps/backend` の `type-check`, `test`, `lint` が通る
