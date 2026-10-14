# Frontend Application

Next.js 15 App Router + React 19 + Tailwind CSS v4のスタッフ閲覧・管理画面です。OpenNext経由でCloudflare Workersへ配備します。

## ローカル開発

依存関係とDBは[ルートのセットアップ](../../README.md#開発を始める)に従い、Backendを起動しておきます。以下は `apps/frontend` 内で実行します。

```bash
cp .env.example .env
bun run dev
```

既存の `.env` は上書きせず確認します。`NEXT_PUBLIC_API_URL` はローカルで `http://localhost:8080`、`JWT_SECRET` はBackendと同じローカル用の値に設定してください。公開クライアントへsecretを渡す `NEXT_PUBLIC_` 変数は作りません。

`dev`はOpenNextビルド後にWranglerを起動します。表示は `http://localhost:8771/access` から確認できます。secretを `.dev.vars` に分ける場合も、Next.jsのビルド・サーバー側で必要な環境値は [.env.example](.env.example) に沿って用意します。

## 画面と認証

- スタッフは `/access` から会期のアクセスコードを入力して閲覧します。
- 管理者は `/login` からログインし、会期を選んで内容を編集します。
- コンテンツは `app/(authenticated)/` 配下で共通レイアウトを使います。ルート保護は [middleware.ts](middleware.ts)。
- ページの現行仕様は[画面仕様一覧](../../docs/README.md#画面仕様)、利用手順は[マニュアル](../../docs/README.md#利用手順)を参照します。

| 共通処理 | 実装 |
|---|---|
| JWT payloadの解決とコンテンツ取得ヘッダー | [app/lib/serverAuth.ts](app/lib/serverAuth.ts) |
| Backend Service Binding優先、通常fetchへのフォールバック | [app/lib/backendFetch.ts](app/lib/backendFetch.ts) |
| `AppType`を使うHono Client | [app/utils/client.ts](app/utils/client.ts) |
| 共通ヘッダー / 管理者の会期選択 | [components/AuthHeader.tsx](components/AuthHeader.tsx) / [components/EventSelector.tsx](components/EventSelector.tsx) |

管理者の会期クエリは `event_id`、APIへ渡すヘッダーは `x-event-id`です。閲覧者の会期は `access_token` から解決します。フォームはBackend共有Zod schemaを優先します。

## コマンドとテスト

正本は [package.json](package.json)です。

| 作業 | コマンド |
|---|---|
| 開発 | `bun run dev` |
| Next.js / Cloudflare build | `bun run build` / `bun run build:cloudflare` |
| 必須チェック | `bun run type-check` / `bun run lint` / `bun run test` |
| テストwatch | `bun run test:watch` |
| dev / prod配備 | `bun run deploy:dev` / `bun run deploy` |

テストはJest + Testing Library + MSWです。`bun run test` を使い、必要なpolyfill・Jest設定は維持します。これらのテストと実ブラウザ・実機確認は別に記録します。

MSW設定、OpenNext/Workersのbinding、共有 `JWT_SECRET`、CI配備の詳細は[開発リファレンス](../../docs/development-guide.md)へ、変更・検証・PR規約は [AGENTS.md](../../AGENTS.md)へ集約しています。
