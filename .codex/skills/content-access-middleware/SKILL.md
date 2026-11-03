---
name: "content-access-middleware"
description: "`contentAccessMiddleware` の認可仕様を実装・テストするときに使う。イベント一致と管理者ロールの境界を確認する。"
---

# Content Access Middleware ガイド

参照: `AGENTS.md` の「実装で守る境界」、`docs/development-guide.md` の「コンテンツアクセスミドルウェア」「ロールと RBAC」、`apps/backend/src/presentation/middleware/contentAccessMiddleware.ts`。

## 目的
コンテンツ GET API が以下のみ通過するよう保証する:
1. `access_token` Cookie が有効で `payload.event_id === x-event-id`
2. `auth_token` Cookie が有効で `payload.role === 'admin'`

## 実装ポイント
- ファイル: `apps/backend/src/presentation/middleware/contentAccessMiddleware.ts`
- JWT 検証: `verify(token, JWT_SECRET, 'HS256')`
- 署名エラー/未設定は `401`。
- `auth_token(role=user)` は拒否。
- `access_token` / `auth_token` のどちらかで条件を満たせば `await next()`。
- 現行実装では middleware 内で `c.set(...)` は行わず、認可判定に集中させる。

## 受け口
- Request header `x-event-id` は `access_token` の `event_id` 一致判定に使用する。
- `Cookie` から `access_token` / `auth_token` を抽出（`hono/cookie` の `getCookie` を使用）。
- `JWT_SECRET` は Cloudflare Workers の secret。ローカル feature test では `app.request(..., {}, { JWT_SECRET })` で注入。

## テスト戦略
1. **単体テスト** (`tests/presentation/middleware/contentAccessMiddleware.test.ts`)
   - access_token 正常系: event_id 一致で next() へ進む。
   - access_token event_id 不一致 → 401。
   - auth_token admin → 通過。
   - auth_token user → 401。
   - いずれも無い/署名不正 → 401。
2. **フィーチャーテスト**
   - 各 GET コンテンツ API のテストで、`contentAccessMiddleware` 経由の 200/401 ケースを確認。

## 実装後チェック
- すべての閲覧系 route (`/api/timetable|rooms|programs|shop-items|others`) が middleware を適用。
- `authMiddleware` と重複しないよう、読み取り用途では `contentAccessMiddleware` のみ使用。
- `apps/backend` で `bun run type-check`, `bun run lint`, `bun run test`。

## 提出物
- middleware 実装 + 単体テスト
- Feature test での 200/401 分岐
- ドキュメント更新が必要なら `AGENTS.md` or `docs/` に追記
