# Phase 11: Workers AI (AI Search) RAG チャット（FAB + モーダル）

> 旧 Phase 6。セキュリティの総当たり対策（[Phase 6](./phase6-rate-limit-turnstile.md)）に番号を譲り、Phase 11 へ移動。

## 対象

- `docs/implementation-plan.md`
- `docs/pages/04-home.md`
- `docs/pages/05-timetable.md`
- `docs/pages/06-rooms.md`
- `docs/pages/07-events.md`
- `docs/pages/08-shop.md`
- `docs/pages/09-search.md`
- `docs/pages/13-others.md`

## 目的

認証済みコンテンツページ上で、ユーザーが右下のチャットボタンからモーダルを開き、
会期スコープ内の情報を自然言語で取得できるようにする。

RAG のデータ対象は既存 DB の 5 ドメインに限定する。

- `timetable_items`
- `rooms`
- `programs`
- `shop_items`
- `other_items`

## 実装順序

backend と frontend をまたぐため、以下の順序を厳守する。

1. Backend 実装
2. Backend テスト
3. Frontend 実装
4. Frontend テスト

## 実装内容

1. `apps/backend/wrangler.jsonc` に AI Search (`ai_search`) バインディングを追加する（dev/prod 両方）
2. `apps/backend/src/db/connection.ts` の `Env` 型を拡張し、AI Search バインディングを扱えるようにする
3. `POST /api/ai/chat` を backend に新設し、`contentAccessMiddleware` を適用する
4. `POST /api/ai/chat` は `message` と `x-event-id` を必須入力として検証する
5. AI Search 呼び出し時に `event_id` メタデータフィルタを必須化し、会期越境を防止する
6. レスポンスは `answer` と `sources`（どのドメイン・どのレコード由来か）を返す
7. 5 ドメインをチャンク化して AI Search へ同期する処理を実装する
8. 同期方式は「CRUD 時差分同期（upsert/delete） + Cron Trigger による定期バッチ再同期」とする
9. Cron Trigger は 1 日 1 回の深夜 03:00（JST）に実行する
   - Wrangler の cron 設定は UTC で `0 18 * * *` を使用する
10. frontend に `AiChatLauncher`（Client Component）を追加する
11. `(authenticated)` レイアウトに右下 FAB を常時配置し、クリックでチャットモーダルを開閉できるようにする
12. ルーティング条件で `/dashboard` と `/admin/*` では FAB とモーダルを表示しない
13. モーダル内に会話履歴、入力欄、送信ボタン、エラーメッセージ表示を実装する
14. 初期リリースは非ストリーミング応答（送信後に回答を一括表示）とする

## このフェーズでやらないこと

- `/dashboard` と `/admin/*` でのチャット表示
- manual / docs / PDF など DB 以外のデータ取り込み
- 会話履歴の永続化
- ストリーミング応答（SSE）
- 管理者手動の初期一括インデックス実行 API

## テスト

### Backend

- `POST /api/ai/chat` で認証なし `401` を返す
- `message` または `x-event-id` 不備で `400` を返す
- 正常系で `200` と `answer/sources` が返る
- `event_id` フィルタにより別会期データが混在しない
- 差分同期（upsert/delete）でインデックスが追従する
- Cron バッチ実行で 5 ドメインの再同期が行われる
- Cron バッチの失敗時にログが記録される

### Frontend

- コンテンツページで FAB が表示される
- `/dashboard` と `/admin/*` で FAB が表示されない
- FAB クリックでモーダルが開く
- 背景クリックと `Escape` でモーダルが閉じる
- API 成功時に回答と引用ソースが表示される
- API 失敗時にエラー表示される

## 完了条件

- 対象ページ（`/`, `/timetable`, `/rooms`, `/events`, `/shop`, `/others`, `/search`）でのみチャットを利用できる
- `/dashboard` と `/admin/*` ではチャット UI が表示されない
- 回答は 5 ドメインを根拠として返り、会期越境が発生しない
- `apps/backend` の `type-check`, `test`, `lint` が通る
- `apps/frontend` の `type-check`, `test`, `lint` が通る
- `docs/implementation-plan.md` と `docs/pages` が Phase 11 仕様に追従している
