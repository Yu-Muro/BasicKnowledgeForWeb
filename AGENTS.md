# AGENTS.md

## 会話と作業の基本

- 会話・レビュー・コミット・PRは日本語。結論を先に、簡潔に伝える。
- 実装や既存資料で確認できることは先に調べる。判断に必要な情報が不足する場合はユーザーへ質問し、独立して進められる作業は続ける。
- 作業前にブランチと差分を確認し、ユーザーの既存変更を上書き・巻き戻し・無断でコミットしない。
- 調査結果、実装から確認した状態、実環境で検証済みの状態を区別する。

## プロジェクトと正本

Bunモノレポ。依存追加・スクリプト実行はBunを使う。

| 対象 | 構成 | 開発ポート |
|---|---|---|
| `apps/backend` | Hono + Drizzle + CockroachDB、Workers/Hyperdrive | 8080 |
| `apps/frontend` | Next.js 15 App Router + React 19 + Tailwind v4、OpenNext/Workers | 8771 |
| `apps/email-worker` | Cloudflare Email Service。backendからService Bindingで呼ぶ専用Worker | 8789 |

- コマンド: 各アプリの `package.json`。ルートにはlint/testスクリプトがない。
- データモデル: `apps/backend/src/db/schema.ts` と `apps/backend/drizzle/`。
- Worker名・binding・環境値: 各アプリの `wrangler.jsonc`。
- CI/CD: `.github/workflows/`。PR形式: [.github/pull_request_template.md](.github/pull_request_template.md)。
- ドキュメントの入口と資料の役割: [docs/README.md](docs/README.md)。
- 画面/APIの現行仕様: 実装を確認して `docs/pages/`・`docs/apis/` を同期する。計画は `docs/tasks/`。
- レイヤー構成、モック、MSW、CI/Renovateの詳細: [開発リファレンス](docs/development-guide.md)。必要な節だけ読む。

## SkillsとPluginsの使い分け

開始時に、そのセッションで利用可能なSkillsとツールを確認する。
関連するSkillの `SKILL.md` を読み、初回利用時はユーザーへ簡潔に伝える。
一覧にあるSkillsを一括で読む必要はない。名前が似ているだけで起動せず、依頼の目的と対象で選ぶ。

### リポジトリ固有のSkills

以下は `.codex/skills/<名前>/SKILL.md`。現行コードの配置・認証契約・テスト手順を担当する。

| 作業 | 選択するSkill |
|---|---|
| 新機能の実装順序・チェック・PR | `new-feature` |
| Backend全体の構成を把握 | `backend-overview` |
| 新しいドメイン・リソースを追加 | `add-domain` |
| コンテンツGET APIを追加・修正 | `backend-content-get-apis` |
| コンテンツ閲覧の認可を変更 | `content-access-middleware` |
| スキーマ・migrationを変更 | `db-migrate` |
| 認証の回帰テスト・JWT secret運用を強化 | `auth-hardening-tests` |
| Frontend全体の構成を把握 | `frontend-overview` |
| 認証後レイアウト・ナビ・会期選択 | `frontend-authenticated-layout` |
| 時間割・部屋・部署ページ | `timetable-page` / `rooms-page` / `departments-page` の該当するもの |
| `docs/pages`を現行実装に同期 | `docs-pages-maintenance` |
| エージェント指示の挙動を実測して改善 | `empirical-prompt-tuning` |

ページSkillとAPI/DB Skillは、変更がその領域まで及ぶ場合に組み合わせる。
既存機能の修正で、Skillに列挙された全機能を作り直したりスキーマを追加したりしない。

### 共通ガイドとCloudflare Plugin

- 個人環境では `/Users/y_murotani/.codex/guides/skill-plugin-guide.md` を読み、選択・実施・検証・引き継ぎに適用する。同じタスクで既読かつ更新がなければ再読不要。読めない環境ではその旨を伝え、利用可能なSkillsと本書で作業を続ける。
- 汎用設計、セキュリティ監査、日本語推敲、文書作成、外部サービスの振り分けは共通ガイドを参照する。一覧やPluginキャッシュパスをここに複製しない。導入状態の記録より、実行時の利用可能一覧・接続状態・対象バージョンを優先する。
- Cloudflare開発は `cloudflare` と必要な専門Skillを選ぶ。Worker実装/設定レビューは `workers-best-practices`、Wrangler実行前は `wrangler`、メールは `cloudflare-email-service`。Access、Turnstile、性能などは対象に合う専門Skillを追加する。
- プロジェクトSkillsはローカルの実装契約、Plugin Skillsは製品固有の操作と最新仕様を担当する。API・制限・設定は公式資料と導入済みの型/設定スキーマで確認する。
- ツールは用途で選ぶ。コード検索は `rg`、シンボル操作は利用可能ならSerena、UI操作は利用可能なブラウザツール、性能計測はChrome DevTools。削除済みのPlaywright Skill/MCPを前提にしない。
- 共通ガイドやSkillと競合する具体的なプロジェクト規則・今回のユーザー指示を優先する。Skill利用だけでインストール・権限変更・外部送信・デプロイを追加しない。
- Cloudflare管理画面・DNS・実配送はコードと分けて検証する。完了時に変更理由、実際の検証、未確認事項、成果物の所在を残す。

## 実装で守る境界

- BackendとFrontendにまたがる変更は **Backend実装 → Backendテスト → Frontend実装 → Frontendテスト**。Backendの振る舞いとテストが揃う前にFrontend実装を始めない。
- Backendの依存は `routes → controllers → use cases → repositories → db`。routeがComposition Root、controllerはuse case interface、use caseはrepository interfaceに依存する。
- 業務クエリのDrizzle操作はrepository実装に置く。bindingから依存を組み立てるのはroute層。認証middlewareの `c.env.JWT_SECRET` 参照は既存の境界として維持する。
- `apps/backend/src/index.ts` の `AppType`、Frontendの `resolveAuth` / `buildContentFetchHeaders` / `backendFetch` を再利用し、Cookie・イベントヘッダー処理を分散させない。
- コンテンツGETは `contentAccessMiddleware` を適用し、有効な `access_token` の `event_id` と `x-event-id` が一致する場合、または有効な `auth_token` のroleが `admin` の場合だけ許可する。`auth_token(user)` 単独では閲覧できない。編集系の認証・管理者権限も確認する。
- CockroachDBの複合FKは、参照先のUNIQUE INDEXをmigrationのFK追加より先に作る。部分適用後の再試行を考慮する。
- Workers用tsconfigに `bun-types` と `@cloudflare/workers-types` を混在させない。テスト環境の設定を分離する。
- フォームは共有Zod schemaを優先。Biome設定と既存コードの流儀を守る。secret・平文パスワード・メール認証コードをコミットやログへ出さない。
- 画面仕様変更時は `docs/pages` を同期する。連番を維持し、`others`を最後にする。改名時は参照先も更新する。

## コマンドと検証

ルートで `bun install`。以下は対象アプリのディレクトリ内で実行する。

| 対象 | コード変更時の必須チェック | ビルド・開発 |
|---|---|---|
| Backend | `bun run type-check` / `bun run lint` / `bun run test` | `bun run build` / `bun run dev` |
| Frontend | `bun run type-check` / `bun run lint` / `bun run test` | `bun run build:cloudflare` / `bun run dev` |
| Email Worker | `bun run type-check` / `bun run lint` / `bun run test` | `bun run build` / `bun run dev` |

- 変更したアプリの必須チェックはpush前にすべて通す。CIもBackend・Frontend・Email Workerの検証とmigration検証を実行する。
- Email Workerの `type-check` は生成済みbinding型の検査を含む。`wrangler.jsonc`変更時は `bun run cf-typegen` で再生成する。
- 文書のみの変更では参照・記述と正本の一致、差分を確認する。Skill変更時はfrontmatterと参照を検証し、動作の変化が大きい場合は `empirical-prompt-tuning` で実行評価する。
- 自動修正は差分を確認する。各アプリの `lint:fix` は `--unsafe` を含む。
- ローカルDBは `apps/backend` で `docker compose up -d`。SQLは26257、管理UIは8888。ローカルの `DATABASE_URL` を確認して `bun run db:migrate` を実行する。
- `db:generate` はmigration生成、`db:migrate` は適用。`db:check` / `db:up` をDBの未適用migration確認・適用コマンドとして扱わず、導入済みDrizzle Kitの用途を確認する。

## Git・PR・レビュー

- 新規作業ブランチは `develop` から作る。Codexの既定は `codex/<task-name>`、明示指定があればそれに従う。既存の作業を続ける場合はそのブランチを確認して使う。
- 変更はレビューとロールバックが独立する論理単位に分ける。コミット件名は `<prefix>(<scope>): <日本語の説明>`（`feat` / `fix` / `test` / `refactor` / `docs` / `chore`）。
- コミット後は作業ブランチをpushし、`develop`向けPRを作る。`develop` / `main`への直接pushは禁止。本番リリースは `develop` → `main` のPR。
- PRのタイトル・本文は日本語で、作成時に実ファイル [.github/pull_request_template.md](.github/pull_request_template.md) を読む。本文は一時ファイルに保存して `gh pr create --base develop --body-file <path>` で渡す。
- レビューは指摘を重要度順（High / Medium / Low）に並べ、対象ファイル・行、問題・影響・修正方法を示す。好みだけの指摘は避ける。
- 指摘がなければ「LGTM」。確認範囲、未実行テスト、残リスクを併記し、判断不能な点は質問として残す。
