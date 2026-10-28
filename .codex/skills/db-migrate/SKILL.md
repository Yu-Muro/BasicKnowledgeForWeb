---
name: db-migrate
description: Drizzle のスキーマ変更後に CockroachDB 向けマイグレーションを生成・検証・適用する具体的な手順。複合FKでのインデックス順序チェックや失敗時の対処も含む。
---

# Drizzle マイグレーション手順

`apps/backend/src/db/schema.ts` の変更に応じてmigrationを生成・検証する。適用先はローカルDBを基本とし、既存の適用履歴と接続先を確認して進める。

## 1. ローカル CockroachDB を起動
```bash
cd apps/backend
docker compose up -d
```
`.env` に `DATABASE_URL=postgresql://root@localhost:26257/basic-knowledge-for-web?sslmode=disable` を設定してから続行。

## 2. Migration ファイル生成
```bash
bun run db:generate
```
生成物は `apps/backend/drizzle/` 以下。

## 3. `migration.sql` を必ず目視確認
- 複合 FK を追加する場合、`CREATE UNIQUE INDEX IF NOT EXISTS ...` が `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` より前に来ているかチェック。
- 順序が逆なら手で並び替える。
- `IF NOT EXISTS` を付けておくと途中失敗後の再実行でも安全。

## 4. Migration 適用
```bash
bun run db:migrate
```
失敗時はエラー、DBの実状態、migrationの適用履歴を照合してから再試行する。既に共有環境へ適用したmigrationは書き換えず、修正migrationを追加する。

## 5. トラブルシューティング
- `index already exists` → 既存indexの列・順序・一意性が意図と一致するか確認する。未共有migrationの再試行を可能にする場合は `IF NOT EXISTS` を検討する。
- `constraint does not exist` → 対象constraintとDB状態を確認する。失敗行を一律に削除せず、未適用の変更と既適用の履歴を区別する。
- `db:check` は `drizzle-kit check`（生成migrationの整合性検査）、`db:up` は `drizzle-kit up`（snapshot形式の更新）。DBの未適用migration確認・適用コマンドではない。DB状態の調査には生成物とDBの適用履歴を照合する。

## 6. CI との整合
`pull-request.yml` の `verify-migration-backend` ジョブでは Docker で CockroachDB を立ち上げ、`bun run db:migrate` を実行する。ローカルで通らない migration は CI でも必ず落ちるため、上記手順で安全性を担保してからコミットする。
