# CLAUDE.md

このファイルは、このリポジトリで Claude Code（claude.ai/code）が作業する際のガイドです。

Claude Code が生成したコードは Codex がレビューします。
Claude Code が行ったレビュー結果は、Codex が妥当性を確認します。

## 概要

Bun モノレポで、Cloudflare Workers 上の 2 アプリで構成されます。
- `apps/backend` — Hono.js REST API（CockroachDB + Drizzle ORM）
- `apps/frontend` — Next.js 15（App Router）+ React 19 + Tailwind CSS v4（OpenNext 経由でデプロイ）

## コマンド

すべてのコマンドは Bun を前提にしています。

### ルート（モノレポ共通）

```bash
bun install          # 全ワークスペースの依存関係をインストール
bun run lint         # ワークスペース全体を Biome で lint
bun run lint:fix     # lint 指摘を自動修正
```

### バックエンド（`apps/backend`）

```bash
bun run dev          # 開発サーバー起動（8080）
bun run type-check   # TypeScript 検証（src + tests）
bun run test         # Jest テスト
bun run lint         # Biome lint
bun run lint:fix     # 自動修正
bun run db:generate  # Drizzle migration 生成
bun run db:migrate   # migration 適用
bun run db:check     # migration 状態確認
bun run db:up        # 未適用 migration 実行
bun run db:drop      # migration 情報の削除
bun run deploy       # Cloudflare Workers へデプロイ（prod）
bun run deploy:dev   # Cloudflare Workers へデプロイ（dev）
```

### フロントエンド（`apps/frontend`）

```bash
bun run dev          # 開発サーバー起動（8771, OpenNext + Wrangler）
bun run build        # Next.js ビルド
bun run build:cloudflare  # Cloudflare 向け OpenNext ビルド
bun run preview      # Wrangler でローカルプレビュー
bun run type-check   # TypeScript 検証
bun run lint         # Biome lint
bun run lint:fix     # 自動修正
bun run test         # Jest (--forceExit)
bun run test:watch   # Jest watch
bun run deploy       # Cloudflare Workers へデプロイ（prod）
bun run deploy:dev   # Cloudflare Workers へデプロイ（dev）
```

### ローカルデータベース

```bash
cd apps/backend
docker compose up -d   # CockroachDB を起動（compose.yaml）
```

`apps/backend/compose.yaml` の設定:
- イメージ: `cockroachdb/cockroach:latest`
- データベース: `basic-knowledge-for-web`, ユーザー: `root`
- ポート: `26257`（SQL）, `8888`（管理 UI。backend 開発サーバー `:8080` との衝突回避）
- 永続化: `db_data` ボリューム

`.env` に以下を設定し、`bun run db:migrate` を実行します:

```env
DATABASE_URL=postgresql://root@localhost:26257/basic-knowledge-for-web?sslmode=disable
```

## コード変更チェックリスト

**コード変更後は、push 前に必ずこの手順を実施してください。**

**実装順序ルール:** backend と frontend をまたぐ機能は、必ず以下の順序で実装します。

1. Backend 実装
2. Backend テスト
3. Frontend 実装
4. Frontend テスト

backend の振る舞いとテストが揃う前に frontend 実装を始めないでください。

### 1. すべてのチェックを通す

```bash
# backend 変更時
cd apps/backend
bun run type-check   # TypeScript エラーなし
bun run lint         # Biome lint エラーなし
bun run test         # テストすべて成功

# frontend 変更時
cd apps/frontend
bun run type-check   # TypeScript エラーなし
bun run lint         # Biome lint エラーなし
bun run test         # テストすべて成功
```

lint エラーは `bun run lint:fix` で自動修正できる場合があります。TypeScript エラーとテスト失敗は手動で修正してください。CI（`pull-request.yml`）でも同じチェックが走るため、ローカルで失敗するコードは CI でも失敗します。

### 2. コミットを意味のある単位に分割する

無関係な変更を 1 つのコミットに混ぜないでください。各コミットは、レビューとロールバックが独立してできる 1 つの論理変更を表すべきです。

**良い例:**
- `feat(users): GET /api/users エンドポイントを追加` — ルート追加のみ
- `test(users): GET /api/users のフィーチャーテストを追加` — テストのみ
- `feat(register): 登録フォーム UI を追加` — frontend のみ

**悪い例:**
- スキーマ変更・ビジネスロジック・UI 更新が 1 コミットに混在
- 無関係な変更をまとめた `WIP` や `fix` コミット

[Conventional Commits](https://www.conventionalcommits.org/) の prefix（`feat`, `fix`, `test`, `refactor`, `docs`, `chore`）を使用します。

**コミットメッセージは日本語必須です。** 件名は `<prefix>(<scope>): <日本語の説明>` 形式にします。

```
# 良い例
feat(users): GET /api/users エンドポイントを追加
fix(auth): JWTトークン検証のバグを修正
test(users): GET /api/users のフィーチャーテストを追加

# 悪い例
feat(users): users 一覧 API を追加
fix: バグ修正
```

### 3. Push して Pull Request を作成する

コミット後はブランチを push し、`develop` 向けに PR を作成します:

```bash
git push -u origin <branch-name>
gh pr create --base develop
```

すべての変更は PR 経由で取り込みます。`develop` や `main` への直接 push は禁止です。

**PR タイトルと説明は日本語で記載し、** プロジェクトテンプレート（`.github/pull_request_template.md`）に従ってください。

```markdown
# Pull Request

## What's changed
このプルリクは何をしたのかを記入してください。画像とテキストを使って説明するのがおすすめです。

## Todo List
今回のプルリクはまだやっていないことや、将来やる予定の事項を記入してください

- [ ] テストケースを書きます

## Remark
補足事項があれば記入してください
```

`gh pr create` の例:

```bash
gh pr create --base develop --title "feat(users): GET /api/users エンドポイントを追加" --body "$(cat <<'EOF'
# Pull Request

## What's changed

`GET /api/users` エンドポイントを追加しました。

- ユーザー一覧を返すAPIを実装
- フィーチャーテストを追加

## Todo List

- [ ] 認証ミドルウェアの追加

## Remark

なし
EOF
)"
```

## アーキテクチャ

### システム構成

```
[ ブラウザ ]
    │
    ├── reitaisai.info          → Cloudflare Workers: basic-knowledge-for-web-frontend
    │       (OpenNext adapter)       Next.js 15 App Router
    │                                R2 bucket: next-cache (ISR cache)
    │
    └── reitaisai.info/api/*    → Cloudflare Workers: basic-knowledge-for-web-backend
            (Hono.js API)            Hyperdrive → CockroachDB (AWS ap-southeast-1)

[ dev.reitaisai.info / dev.reitaisai.info/api/* ] — dev 環境（develop への push で自動デプロイ）
[ reitaisai.info / reitaisai.info/api/* ]          — prod 環境（main への push で自動デプロイ）
```

### バックエンド — Clean Architecture

```
src/
├── db/                   # Drizzle スキーマ + 接続（prod は Cloudflare Hyperdrive）
├── use-cases/            # ビジネスロジック層（1 use case 1 クラス）
│   └── {domain}/
│       ├── I{Name}UseCase.ts   # Use case interface
│       └── {Name}UseCase.ts    # 実装
├── presentation/
│   ├── controllers/      # リクエスト/レスポンス処理（use case interface を受け取る）
│   └── routes/           # Composition Root（repository + use case を組み立ててルート登録）
├── infrastructure/
│   ├── validators/       # リクエスト検証用 Zod スキーマ
│   └── repositories/
│       └── {domain}/
│           ├── I{Name}Repository.ts  # Repository interface
│           └── {Name}Repository.ts   # Drizzle 実装
└── index.ts              # Hono エントリーポイント。ルートを束ねて AppType を export
```

**依存方向:** routes → controllers → use cases → repositories → db

**ルール:**
- route は Composition Root として concrete repository / use case を生成し、controller へ注入する
- controller は use case **interface**（例: `IGetUsersUseCase`）にのみ依存し、concrete class には依存しない
- use case は repository **interface**（例: `IUserRepository`）にのみ依存し、Drizzle へ直接依存しない
- Drizzle（`sql`, `eq` など）を import するのは repository 実装クラスのみ
- Cloudflare Workers の `Env` binding（`c.env`）に触れるのは route 層のみ
- `src/index.ts` は frontend と型安全に連携するため `AppType`（Hono アプリ型）を export する

### バックエンド — データベーススキーマ

Drizzle ORM 上の CockroachDB スキーマ（`src/db/schema.ts`）:

| テーブル | 主要カラム |
|---|---|
| `users` | id, name, email, password, role(default 'user'), created/updated/deleted_at |
| `access_codes` | id, code(unique), event_name, valid_from, valid_to, created_by, created_at |
| `departments` | id, event_id→access_codes, name, created/updated_at; **UNIQUE(event_id,id)** |
| `timetable_items` | id, event_id→access_codes, title, start/end_time, location, description, created/updated_at |
| `rooms` | id, event_id→access_codes, building_name, floor, room_name, pre_day_manager_id(nullable), pre_day_purpose(nullable), day_manager_id, day_purpose, notes(nullable), created/updated_at |
| `programs` | id, event_id→access_codes, name, location, start/end_time, description, image_key/image_url(nullable), created/updated_at |
| `shop_items` | id, event_id→access_codes, name, price, description, image_key, image_url, created/updated_at |
| `other_items` | id, event_id→access_codes, title, content, image_key/image_url(nullable), display_order, created_by, created/updated_at |

**⚠️ CockroachDB — 複合外部キーと migration 順序**
CockroachDB で複合 FK（例: `(event_id, manager_id) → departments(event_id, id)`）を追加するには、
参照先の列の組み合わせに UNIQUE INDEX が先に存在していなければならない。
migration ファイルでは `CREATE UNIQUE INDEX IF NOT EXISTS` を `ADD CONSTRAINT ... FOREIGN KEY` より前に記述すること。
`IF NOT EXISTS` を付けることで migration の部分実行後の再試行でもエラーにならない。

### バックエンド — テスト構成

```
tests/
├── tsconfig.json                                    # VSCode IntelliSense 設定（tsconfig.test.json を継承）
├── helpers/
│   └── createTestApp.ts                             # Feature テスト用 app factory
├── features/
│   ├── health.test.ts                               # /api/health
│   ├── users.test.ts                                # /api/users
│   ├── auth.test.ts                                 # /api/auth/*
│   ├── accessCodes.test.ts                          # /api/access-codes*
│   ├── timetable.test.ts / rooms.test.ts / programs.test.ts
│   ├── shopItems.test.ts / otherItems.test.ts
│   ├── departments.test.ts / search.test.ts
├── use-cases/{domain}/*.test.ts                     # use case 単体テスト（repository interface をモック）
├── presentation/controllers/*.test.ts               # controller 単体テスト（use case interface をモック）
├── infrastructure/
│   ├── validators/*.test.ts                         # Zod validator 単体テスト
│   └── repositories/{domain}/*.test.ts              # repository 単体テスト（DatabaseClient をモック）
```

- テストランナー: **Jest**（`ts-jest`）
- テストコードの import: `@jest/globals`（グローバル依存しない）
- パスエイリアス: `@backend/*` は `src/` を指す（例: `@backend/use-cases/...`）

### Backend — テスト戦略（テストピラミッド）

```
          [Feature テスト]
    Route → Controller → UseCase(real) → Repository(mock)
    - HTTP リクエスト/レスポンスを E2E に近い形で検証
    - Hono の `app.request()` を使用（supertest 不要）
    - Repository は factory 関数 DI で差し替え

        [Unit Tests — Controller]
    Controller(real) → IUseCase(mock)
    - HTTP ステータスとレスポンス形状を検証
    - モックは interface を満たすプレーンオブジェクト

        [Unit Tests — UseCase]
    UseCase(real) → IRepository(mock)
    - ビジネスロジック（メール重複、パスワードハッシュ化など）を検証
    - モックは interface を満たすプレーンオブジェクト

        [Unit Tests — Repository]
    Repository(real) → DatabaseClient(mock)
    - Drizzle クエリ構築が正しいかを検証
    - モックは Drizzle チェーン形状を再現した `jest.fn()` 連鎖

        [Unit Tests — Validator]
    Zod schema のみを検証（依存モック不要）
```

### バックエンド — レイヤー別モックパターン

**Use case / controller のモック: プレーンオブジェクト推奨**

interface を使うことで `as unknown as ConcreteClass` なしでモックできます:

```typescript
const mockUseCase: IGetUsersUseCase = {
    execute: jest.fn<() => Promise<...>>().mockResolvedValue({ success: true, data: [] }),
};
```

**Repository モック: Drizzle クエリチェーン**

チェーン末端のリーフに `mockImplementation(() => Promise.resolve(value))` を使う（`mockResolvedValue` は TS2345 `"not assignable to never"` を起こす）。

**Feature テスト: repository factory DI**

route は DI 用の `repositoryFactory` を任意で受け取れる実装にします。デフォルトは実 DB クライアント、テストではモックを注入します:

```typescript
// Route definition
type UserRepositoryFactory = (env: Env) => IUserRepository;
export function createUserRoutes(
    repositoryFactory: UserRepositoryFactory = (env) =>
        new UserRepository(createDatabaseClient(env)),
) { ... }

// Feature test
const app = new Hono();
app.route('/api', createUserRoutes(() => mockRepository));
const res = await app.request('/api/users');
```

### バックエンド — TypeScript 設定

| ファイル | 用途 |
|---|---|
| `tsconfig.json` | 本番用ソース（`src/`）のみ。`@cloudflare/workers-types` を使用し、`tests/` は除外。 |
| `tsconfig.test.json` | Jest（`ts-jest`）用。`@types/jest` を使用し、`src/` + `tests/` を含む。 |
| `tests/tsconfig.json` | `tsconfig.test.json` を継承。VSCode がテストファイル向けに参照。 |

**⚠️ 型衝突に注意:** `@cloudflare/workers-types` と `bun-types` は同じ tsconfig に含めないでください。  
両者が `Response` / `Body` を定義しており、`Response.json()` が `Promise<undefined>` と解釈されてテスト型が壊れます。必ず別 tsconfig に分離します。

### フロントエンド — Next.js App Router

```
app/
├── layout.tsx                                 # Root layout
├── globals.css                                # Tailwind v4 global styles
├── middleware.ts                              # ルート保護（login/access/admin/content）
├── (authenticated)/                           # 認証後の共通レイアウト配下
│   ├── layout.tsx                             # AuthHeader + AuthProvider
│   ├── admin/*                                # 管理者専用ページ
│   ├── dashboard/page.tsx                     # パスワード変更/ロール変更
│   ├── timetable|rooms|events|shop|others|search/page.tsx
├── login/page.tsx / register/page.tsx / access/page.tsx
├── actions/*.ts                               # Server Actions（CRUD/認証）
├── lib/backendFetch.ts                        # BACKEND service binding経由 fetch
├── lib/serverAuth.ts                          # JWT payload 解決 + ヘッダー組み立て
├── utils/client.ts                            # Type-safe Hono API client
components/
├── AuthHeader.tsx / EventSelector.tsx
└── ui/                                       # shadcn/ui コンポーネント
```

**主要パターン:**
- `app/lib/serverAuth.ts` の `resolveAuth` / `buildContentFetchHeaders` でトークン・`x-event-id` を一元管理
- `app/lib/backendFetch.ts` は Cloudflare の `BACKEND` service binding が使える場合に優先利用し、ローカルでは通常の `fetch` にフォールバック
- `app/utils/client.ts` で `hc<AppType>(NEXT_PUBLIC_API_URL)` を生成し、E2E 型安全を担保
- フォーム系 UI は `react-hook-form` + `zodResolver` + backend 共有 Zod schema を優先

### フロントエンド — テスト

```
tests/
├── tsconfig.json
├── config/CustomJestEnvironment.ts            # jest環境（Edge runtime寄り）
├── mocks/
│   ├── server.ts                                 # MSW サーバー
│   └── handlers.ts                               # API ハンドラ
├── middleware.test.ts                            # ルート保護の分岐
├── login/page.test.tsx / register/page.test.tsx / access/page.test.tsx
└── authenticated/** / admin/**                   # 各ページ・コンポーネントのUIテスト
```

**MSW v2 + Next.js 15 + jsdom の重要設定:**

Jest + jsdom で MSW を動かすには、次の 3 ファイルが必須です。

1. **`jest.polyfills.ts`** — Web API ポリフィル（`setupFiles` で読み込み）:
   ```typescript
   // TextEncoder/TextDecoder, ReadableStream, WritableStream, TransformStream,
   // MessagePort, MessageChannel, BroadcastChannel, fetch（cross-fetch 経由）
   ```

2. **`jest.setup.ts`** — MSW サーバーのライフサイクル（`setupFilesAfterEnv` で読み込み）:
   ```typescript
   beforeAll(() => server.listen())
   afterEach(() => server.resetHandlers())
   afterAll(() => server.close())
   ```

3. **`jest.config.ts`** — MSW の ESM 対応に必要な設定:
   ```typescript
   // custom export conditions を無効化して、MSW の browser bundle 読み込みを防ぐ
   // MSW 関連パッケージを transformIgnorePatterns に追加して Jest 変換対象にする
   ```

**⚠️ ハマりどころ:**
- MSW v2 パッケージは pure ESM のため、`transformIgnorePatterns` へ追加して `ts-jest` 変換対象にする必要がある
- `customExportConditions` に `browser` を含めると Node 上で MSW の browser バンドルを読んで壊れる
- `cross-fetch/polyfill` は MSW サーバー起動前に読み込む必要がある

### Frontend — TypeScript 設定

| ファイル | 用途 |
|---|---|
| `tsconfig.json` | 本番ソース用。jest ファイルと tests を除外。パスエイリアスは `@frontend/*`, `@backend/*`。 |
| `tsconfig.test.json` | Jest 用。`@types/jest`, `@testing-library/jest-dom` を追加。 |
| `tests/tsconfig.json` | `tsconfig.test.json` を継承。VSCode がテスト向けに参照。 |

**パスエイリアス:**
- `@frontend/*` → プロジェクトルート（例: `@frontend/app/utils/client`）
- `@backend/*` → `../backend/*`（frontend から backend 型を import する用途）

### デプロイ

両アプリとも Cloudflare Workers へデプロイします。`wrangler.jsonc` で worker 名、ルート、binding を設定します。

**Cloudflare リソース binding:**

| リソース | Dev | Prod |
|---|---|---|
| バックエンド Worker | `basic-knowledge-for-web-backend-dev` | `basic-knowledge-for-web-backend` |
| フロントエンド Worker | `basic-knowledge-for-web-frontend-dev` | `basic-knowledge-for-web-frontend` |
| ハイパードライブ ID | `f7f0ede9c7464673ab6f5bdcf0753218` | `5a36ae3ca5ed4a4697040c00685f213e` |
| バックエンド画像用 R2 | `dev-basicknowledgeforweb` | `basicknowledgeforweb` |
| Next.js キャッシュ用 R2 | `basic-knowledge-for-web-next-cache-dev` | `basic-knowledge-for-web-next-cache` |
| DB 名 | `Dev-BasicKnowledgeForWeb` | `BasicKnowledgeForWeb` |

- **Backend**: DB 接続に Cloudflare Hyperdrive を使用。ローカル開発では `wrangler.jsonc` の `localConnectionString` を利用（CockroachDB 単一ノード）。
- **Frontend**: `@opennextjs/cloudflare` アダプタを使用。ビルド出力は `.open-next/`。Next.js ISR キャッシュに R2 bucket を使用。
- **API URL**: `NEXT_PUBLIC_API_URL` で切り替え可能（ローカル `http://localhost:8080`、CI では `https://dev.reitaisai.info` または `https://reitaisai.info`）。

## CI/CD — GitHub Actions

### ワークフロー

| ワークフロー | トリガー | ジョブ |
|---|---|---|
| `pull-request.yml` | PR → `main` or `develop` | lint-and-test-backend, verify-migration-backend, lint-and-test-frontend |
| `deploy-dev.yml` | push → `develop` | DB migrate → backend deploy → frontend deploy (env: dev) |
| `deploy-prod.yml` | push → `main` | DB migrate → backend deploy → frontend deploy (env: prod) |
| `security-scan.yml` | PR 作成/更新時 | AikidoSec, Betterleaks, anti-trojan-source |
| `renovate.yml` | 毎日 07:00 JST / 手動実行 | Renovate（セルフホスト）で依存更新 PR を作成。実際に PR を作るかは `renovate.json` の `schedule` が判定 |

### PR チェック（`pull-request.yml`）— 3 並列ジョブ

1. **lint-and-test-backend**: install → build → lint → type-check → jest
2. **verify-migration-backend**: start CockroachDB in Docker → create database → `bun run db:migrate`
3. **lint-and-test-frontend**: install → `build:cloudflare` → lint → type-check → jest

**Renovate 自動マージ**: `renovate-auto-merge` ジョブは、以下を **すべて** 満たす PR に限り、上記 3 ジョブの通過後に自動承認・自動マージします。1 つでも欠ければスキップする fail-closed 設計です。

1. ブランチ名が `renovate/` で始まる
2. PR 作成者が変数 `RENOVATE_ACTOR`（Renovate GitHub App の `<app-slug>[bot]`）と一致する
3. ベースブランチが `develop`
4. fork からの PR ではない
5. `major-update` ラベルが付いていない（ジョブ実行時に API で再確認）

条件 2 が無いと、書き込み権限を持つ利用者が `renovate/*` ブランチから PR を作るだけで通常のレビュー要件を迂回できてしまうため、実行主体の検証を必須にしています。条件 3 は、`main` へリターゲットされた PR が `develop` での検証と dev デプロイを飛ばして本番へ入ることを防ぎます。

条件 5 は `if:` のイベント payload 判定だけでは不十分です。Renovate は PR 作成と `addLabels` を別々の API 呼び出しで行うため、`opened` イベントの payload にはまだ `major-update` が載っていない場合があり、このワークフローは `labeled` では再実行されません。そのため承認・マージの直前に `gh pr view --json labels` で現在のラベルを取得して再判定します。この取得に失敗した場合はジョブごと失敗させ、承認・マージへ進ませません。

### 依存関係の更新（Renovate）

依存パッケージの更新は **Renovate（セルフホスト）** で行います。設定は `renovate.json`、実行は `.github/workflows/renovate.yml` です。

- PR の向き先は `baseBranchPatterns: ["develop"]` により常に `develop`
- Renovate 自身が `bun install` を実行し、**同一コミット内で `bun.lock` を更新**します（Dependabot 時代に必要だった `bun.lock` 更新用の回避ワークフローは廃止済み）
- 保留中の更新は Dependency Dashboard Issue から確認できます
- `drizzle-orm` / `drizzle-kit` は beta 固定運用のため更新対象外です
- 依存パッケージのメジャー更新は `packageRules`（`matchUpdateTypes: ["major"]` → `enabled: false`）により PR 自体が作成されません
- **GitHub Actions のメジャー更新のみ例外的に PR を作成します**（旧 `dependabot.yml` でも `github-actions` は major を除外していなかったため）。互換性破壊の可能性があるため別 PR に分離し、`major-update` ラベルを付けて自動マージ対象から外しています
- ワークフローは毎日起動しますが、通常更新は `schedule: ["before 9am on monday"]` により週次のままです。Renovate の `schedule` は「bot の起動時刻」ではなく「ブランチを作成してよい時間帯」を制限する設定のため、週次起動にすると `lockFileMaintenance` の「毎月1日」の時間帯と交差しない月が生じてしまいます
- **PR 数の制限は `prConcurrentLimit: 10` のみで、`prHourlyLimit` は `0`（無制限）です。** 通常更新のブランチ作成が許されるのは `schedule` により週 1 回（毎週月曜 07:00 JST の起動）だけなので、1 回の実行で作れる PR 数がそのまま週あたりの上限になります。移行前 90 日間の Dependabot マージ実績は 100 件（約 7.7 件/週）で、グルーピング後も週 5 件前後は見込まれるため、時間あたりの上限を残すと恒常的なバックログになります
- **Renovate 本体のバージョンは `renovate.yml` の `renovate-version` で固定します。** `uses` の SHA 固定で止まるのは Action のラッパーだけで、本体は `action.yml` の既定値（メジャータグ `'44'`）が指す Docker イメージのため、固定しないと実行のたびに未検証のビルドを取得します。GitHub App は Workflows の書き込み権限を持つため、本体も明示的に固定します。更新は `renovate.json` の `customManagers` が `ghcr.io/renovatebot/renovate` の Docker タグとして PR で提案します（メジャー更新は `major-update` ラベル付きで自動マージ対象外）
- Renovate は専用 GitHub App のインストールトークンで実行します。トークンはワークフローごとに発行され、PR 作成者は `<app-slug>[bot]` になります
- `RENOVATE_PLATFORM_COMMIT: "enabled"` により GitHub API 経由でコミットし、GitHub App の署名を付けます

### 必須シークレット

| シークレット | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | デプロイワークフロー |
| `CLOUDFLARE_ACCOUNT_ID` | デプロイワークフロー |
| `DATABASE_URL` | デプロイワークフロー（db:migrate） |
| `RENOVATE_APP_PRIVATE_KEY` | Renovate 専用 GitHub App の秘密鍵（PEM）。リポジトリへコミットせず、Actions Secret に登録します |

### 必須変数（Variables）

| 変数 | 用途 |
|---|---|
| `RENOVATE_APP_CLIENT_ID` | Renovate 専用 GitHub App の Client ID。実行時のインストールトークン生成に使用します |
| `RENOVATE_ACTOR` | Renovate GitHub App の `<app-slug>[bot]`。`pull-request.yml` の `renovate-auto-merge` が PR 作成者の検証に使用します。**未設定の場合、Renovate PR の自動マージは行われません**（fail-closed） |

**⚠️ Renovate GitHub App は `BasicKnowledgeForWeb` のみにインストールしてください。**
Repository permissions は Administration: Read-only、Checks / Commit statuses / Contents / Issues / Pull requests / Workflows: Read and write、Dependabot alerts: Read-only とします。インストールトークン生成時にも同じ権限を明示し、App に付与された権限を丸ごと継承しません。`RENOVATE_ACTOR` を App の bot アカウントに限定することで、書き込み権限を持つ利用者が `renovate/*` ブランチから PR を作ってレビュー要件を迂回する経路を閉じます。

## 環境変数

### バックエンド（`.env.example`）

```env
DATABASE_URL=postgresql://root@localhost:26257/basic-knowledge-for-web?sslmode=disable
NODE_ENV=local
PORT=8080
```

### フロントエンド（`.env.example`）

```env
# ローカル:  http://localhost:8080
# dev環境:   https://dev.reitaisai.info
# prod環境:  https://reitaisai.info
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## コードスタイル

- **Formatter/Linter**: Biome（ルート `biome.json` で設定）
- インデント: 4 スペース、行幅: 80、シングルクォート、セミコロン必須
- `noUnusedImports` と `noUnusedVariables` は warning
- `noNonNullAssertion` は無効化
- 両アプリとも TypeScript strict モード
- Path aliases: `@backend/*` → `src/` (backend), `@frontend/*` / `@backend/*` (frontend)

## 実装時の注意

### ブランチ命名規則

| Prefix | 用途 |
|---|---|
| `feature/` | 新機能・機能追加 |
| `fix/` | バグ修正 |
| `docs/` | ドキュメント変更のみ |
| `chore/` | リファクタリング・ツール・依存更新 |

必ず `develop` からブランチを切り、PR の向き先は `develop` にします。`develop` から `main` へマージして本番リリースします。

### `docs/pages` 運用ルール

- 仕様書の正は **実装コード**（`apps/backend` / `apps/frontend`）とし、`docs/pages/*.md` は必ず実装へ追従させる。
- API 仕様更新時は `routes` / `controllers` / `validators` / `middleware` を確認し、認証条件・ヘッダー要件（特に `x-event-id`）をドキュメントへ反映する。
- 画面仕様更新時は `app/(authenticated)/**/page.tsx` と `app/actions/*.ts` を確認し、`admin` / `user` の表示分岐をドキュメントへ反映する。
- `docs/pages` の並び順は連番で管理し、**`others` は最後**に置く（現行: `13-others.md`）。
- ファイル名を変更した場合は、`docs/tasks/*.md` などの参照先を必ず同時更新する。
- `docs/pages` を更新する際は以下の旧仕様文字列を残さないことを確認する:
  - `Admin/Developer`
  - `upload-url`
  - 旧パス（例: `/admin/access-code`）

### 認証

JWT ベース認証を採用しており、トークンは 2 種類あります。

| トークン | Cookie 名 | 発行エンドポイント | Payload | スコープ |
|---|---|---|---|---|
| Access token | `access_token` | `POST /api/access-codes/verify` | `{ event_id, exp }` | イベント単位 |
| Auth token | `auth_token` | `POST /api/auth/login` | `{ id, name, email, role, exp }` | ユーザー単位 |

- JWT secret は Cloudflare Workers secret（`JWT_SECRET`）で管理し、`wrangler.jsonc` には置かない
- トークン検証は `hono/jwt`（`verify(token, secret, 'HS256')`）を使用
- 認証ロジックは `src/presentation/middleware/` に集約

### コンテンツアクセスミドルウェア

`contentAccessMiddleware` (`src/presentation/middleware/contentAccessMiddleware.ts`) は全コンテンツ GET API に適用する。

以下のいずれかを満たすリクエストのみ通過させる:

1. **access_token 認証**: `access_token` Cookie の JWT が有効、かつ `payload.event_id === x-event-id` ヘッダーの値
2. **auth_token 認証**: `auth_token` Cookie の JWT が有効、かつ `payload.role === 'admin'`

`role=user` の `auth_token` はコンテンツ API を通過できない。一般ユーザーは `access_token` が必要。
どちらも満たさない場合は `401 Unauthorized` を返す。

Feature テストでは `app.request(path, { headers }, mockEnv)` の第3引数で `{ JWT_SECRET }` を渡す。

### ロールと RBAC

`users.role` は現在 2 ロールをサポートします。

| ロール | 説明 |
|---|---|
| `user` | 一般ユーザー（デフォルト） |
| `admin` | 管理者権限 |

コンテンツ GET API では `contentAccessMiddleware` が role チェックを担い、
`access_token`（event一致）または `auth_token(admin)` のみ通過する。
より細かい RBAC が必要な場合は use case 層に追加する。

### Soft Delete（今後対応）

現時点で `deleted_at` を持つのは `users` テーブルのみ。
今後ほかのテーブルへ広げる場合は次を適用する:
- `findAll` / `findByEmail` などの取得クエリに `.where(isNull(table.deletedAt))` を追加する
- 削除エンドポイントは `DELETE` ではなく `UPDATE ... SET deleted_at = now()` を使う
- soft delete 済みレコードを API レスポンスに含めない

### 新規ドメイン追加チェックリスト

backend に新しいリソース（例: `posts`）を追加する手順:

1. **Schema**（`src/db/schema.ts`）— Drizzle テーブル定義を追加
2. **Migration** — `bun run db:generate` → `bun run db:migrate`
3. **Repository** — `IPostRepository.ts`（interface）+ `PostRepository.ts`（Drizzle 実装）
4. **Validator** — `src/infrastructure/validators/postValidator.ts`（Zod スキーマ）
5. **Use Cases** — `ICreatePostUseCase.ts` + `CreatePostUseCase.ts`, etc.
6. **Controller** — `src/presentation/controllers/postController.ts`
7. **Routes** — `src/presentation/routes/postRoutes.ts` (Composition Root)
8. **Mount** — `src/index.ts` へ `app.route('/api', createPostRoutes())` を追加
9. **Tests** — 各レイヤー（feature → controller → use-case → repository → validator）のテストを追加

### CORS 設定

CORS は `src/index.ts` で設定します。許可オリジン:
- `https://reitaisai.info`
- `https://dev.reitaisai.info`
- `http://localhost:8771`

新しいオリジンが必要になった場合は `src/index.ts` の CORS 設定を更新してください。

### 共有 Zod スキーマ

バリデーションスキーマ（例: `createUserSchema`）は frontend から `@backend/infrastructure/validators/userValidator` として import できます。重複定義を避けるため backend 側のスキーマを再利用してください。

### パスワードハッシュ化

`bcryptjs`（salt rounds = 12）を使用します。frontend から受け取った平文パスワードは `CreateUserUseCase` 内でハッシュ化し、API レスポンスへは絶対に含めません。

### Result 型（Discriminated Union）

use case の返り値は必ず `{ success: true; data: T } | { success: false; error: string }` の形式に統一し、controller は `success` フラグで HTTP ステータスを分岐します。

### Cloudflare Workers の制約

- モジュールレベルのグローバル状態は同一 Worker インスタンス内でリクエストをまたいで残るため注意する。DB 接続はリクエストごとに作成する設計（接続プールは Hyperdrive が管理）。
- Workers 用 tsconfig に `bun-types` を含めると `@cloudflare/workers-types` と `Response` / `Body` が競合する。production tsconfig は `@cloudflare/workers-types` のみを使用。
- `nodejs_compat` フラグを有効化しているため、Node.js 組み込み（`crypto`, `buffer` など）が利用可能。

### セキュリティスキャン

PR 作成時に次のスキャンが自動実行されます。
- **AikidoSec Safe Chain** — 依存関係の脆弱性スキャン
- **Betterleaks** — シークレット漏えい検知
- **anti-trojan-source** — Unicode 制御文字を用いた難読化検知

`.env` や `terraform.tfvars` などの機密ファイルは `.gitignore` で除外されています。コミット前は必ず `git status` を確認し、シークレットが stage されていないことを確認してください。
