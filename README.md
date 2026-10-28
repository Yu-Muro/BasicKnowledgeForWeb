# BasicKnowledgeForWeb

イベントスタッフ向けに、会期ごとの時間割・部屋割り・企画・販売物・お知らせを提供するポータルです。スタッフはアクセスコードで閲覧し、管理者はアカウントでログインして内容を管理します。

## 構成

Bunモノレポとして、3つのアプリをCloudflare Workersで動かします。

| アプリ | 役割 | 主な技術 |
|---|---|---|
| [Backend](apps/backend/README.md) | API、認証、会期別データ、画像 | Hono、Drizzle、CockroachDB、Hyperdrive、R2 |
| [Frontend](apps/frontend/README.md) | スタッフ閲覧・管理画面 | Next.js 15、React 19、Tailwind v4、OpenNext |
| [Email Worker](apps/email-worker/README.md) | Service Binding経由の内部メール送信 | Cloudflare Email Service |

メール送信基盤は実装済みです。メール検証・OTPログイン・信頼デバイスは[Phase 5の計画](docs/tasks/phase5-email-auth-with-email-worker.md)であり、現行のログイン仕様とは区別します。

## 開発を始める

Bun、Node.js、Docker、Gitを用意します。CIのランタイム設定は [.github/actions/setup-bun-project/action.yml](.github/actions/setup-bun-project/action.yml) を参照してください。

```bash
git clone https://github.com/Yu-Muro/BasicKnowledgeForWeb.git
cd BasicKnowledgeForWeb
bun install
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

backend/frontendの `JWT_SECRET` は同じローカル用の値へ変更します。既存の `.env` がある場合はコピーで上書きせず、その内容を確認してください。設定の詳細は各アプリのREADMEを参照してください。

次にローカルDBを用意します。

```bash
cd apps/backend
docker compose up -d
# DB起動後に実行。既存DBがある場合もそのまま利用する。
docker compose exec db cockroach sql --insecure   -e 'CREATE DATABASE IF NOT EXISTS "basic-knowledge-for-web";'
bun run db:migrate
```

初回セットアップは既存migrationの適用のみ行います。`db:generate` はスキーマを変更したときに実行します。

各ターミナルで、リポジトリルートから対象アプリに移動して起動します。

| 対象 | 起動コマンド | ローカルURL |
|---|---|---|
| Backend | `cd apps/backend` → `bun run dev` | `http://localhost:8080` |
| Frontend | `cd apps/frontend` → `bun run dev` | `http://localhost:8771` |
| Email Workerを検証する場合 | `cd apps/email-worker` → `bun run dev` | `http://localhost:8789` |

Frontendの `dev` はOpenNextビルド後にWranglerを起動します。ローカルの入口は `http://localhost:8771/access` です。Email Workerの実配送には別途Cloudflare側の設定が必要です。

## 検証と変更の提出

変更したアプリのディレクトリで実行します。テストランナーはJestなので、`bun run test` を使用します。

```bash
bun run type-check
bun run lint
bun run test
```

必須チェックとBackend→Frontendの実装順序、ブランチ・日本語コミット・`develop`向けPRの規約は [AGENTS.md](AGENTS.md) にまとめています。

## ドキュメント

[ドキュメント案内](docs/README.md)から、目的に合う資料を選べます。

- [開発リファレンス](docs/development-guide.md): レイヤー構成、テスト、CI、デプロイ、依存更新
- [API一覧](docs/apis/README.md): 現行エンドポイントと認証条件
- [スタッフ向けマニュアル](docs/manuals/user-manual.md) / [管理者向けマニュアル](docs/manuals/admin-manual.md): 利用手順
- [ロードマップ](docs/tasks/roadmap.md): 今後の実装計画と優先順位

`develop`へのpushでdev、`main`へのpushでprodへ配備します。実際の順序・環境設定は [.github/workflows](.github/workflows) と各アプリの `wrangler.jsonc` が正本です。
