# Backend API

Hono + Drizzle + CockroachDBによるAPIです。Cloudflare Workers上で動かし、DB接続にはHyperdrive、画像にはR2、メール送信にはEmail WorkerのService Bindingを使います。

## ローカル開発

依存関係は[ルートのセットアップ](../../README.md#開発を始める)でインストールします。以下は `apps/backend` 内で実行します。

```bash
cp .env.example .env
docker compose up -d
docker compose exec db cockroach sql --insecure   -e 'CREATE DATABASE IF NOT EXISTS "basic-knowledge-for-web";'
bun run db:migrate
bun run dev
```

既存の `.env` は上書きせず内容を確認してください。DB起動前にSQLコマンドを実行すると接続に失敗するため、起動を待って再実行します。

| 設定 | 用途・確認先 |
|---|---|
| `DATABASE_URL` | Drizzle Kitのmigration接続先。ローカル値は [.env.example](.env.example) |
| `JWT_SECRET` | Frontendと同じローカル用secretを `.env` または `.dev.vars` に設定 |
| `HYPERDRIVE.localConnectionString` | API実行時のDB接続先。[wrangler.jsonc](wrangler.jsonc)で確認 |
| `SHOP_ITEM_ASSET_BASE_URL` | 画像URL。ローカルとdev/prodの値はWrangler設定を確認 |
| `EMAIL_WORKER` | メール専用WorkerへのService Binding。[Email Worker README](../email-worker/README.md) |

APIは `http://localhost:8080`、SQLは26257、DB管理UIは `http://localhost:8888`。本番secretはWorkers Secretで管理し、設定値をコミットしません。

## 実装と仕様

- [API一覧](../../docs/apis/README.md)がエンドポイント、Cookie、`x-event-id`の入口です。
- データモデルは [src/db/schema.ts](src/db/schema.ts)、migrationは [drizzle](drizzle)を確認します。READMEへSQLの写しを置きません。
- `routes → controllers → use cases → repositories → db` の境界、DI、Jestのモック手順は[開発リファレンス](../../docs/development-guide.md)を参照します。
- `auth_token`はユーザー認証、`access_token`は会期単位の閲覧認証です。一般ユーザーの `auth_token` 単独ではコンテンツGETを許可しません。

## コマンド

正本は [package.json](package.json)です。

| 作業 | コマンド |
|---|---|
| 開発 / dry-run build | `bun run dev` / `bun run build` |
| 必須チェック | `bun run type-check` / `bun run lint` / `bun run test` |
| migration生成 / 適用 | `bun run db:generate` / `bun run db:migrate` |
| dev / prod配備 | `bun run deploy:dev` / `bun run deploy` |

`db:generate`はスキーマ変更時に使います。複合FKは参照先UNIQUE INDEXを先に作成します。Jestは `bun run test` で起動し、DB適用先と配備環境は実行前に確認します。

共通の変更・検証・PR規約は [AGENTS.md](../../AGENTS.md)、CI配備と共有 `JWT_SECRET` の運用は[開発リファレンス](../../docs/development-guide.md#デプロイ)を参照してください。
