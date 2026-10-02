---
name: auth-hardening-tests
description: Frontend middlewareとBackend認証ルートの回帰テスト、JWT secret運用を点検・強化するときに使う。
---

# Auth Hardening & Tests ガイド

## スコープ
1. Frontend middleware (`apps/frontend/middleware.ts`) のテスト追加
2. Backend auth / access-code ルートの feature test 追加
3. Secret 運用ドキュメント整備

## 手順
### 1. Frontend middleware テスト
- MSW と `@edge-runtime/vm` 設定を流用して `apps/frontend` の Jest 環境で middleware をテスト。
- ケース:
  1. `auth_token`(admin) で `/admin/*` と各コンテンツページを許可。
  2. `access_token` (user) でコンテンツページを許可。
  3. 未認証で `/access` or `/login` にリダイレクト。
  4. `JWT_SECRET` 未設定/不正署名トークンで fail-closed。
- `bun run test` で middleware 分岐のカバレッジ確認。

### 2. Backend auth/access-code ルートテスト
- 対象: `authRoutes`, `accessCodeRoutes`, `authMiddleware`, `roleGuard`。
- Feature tests で以下を網羅:
  - `POST /api/auth/login`: 正常 / 認証失敗 / バリデーション。
  - `GET/POST/DELETE /api/access-codes`: ロール別の認可境界 (admin のみ許可)。
  - `POST /api/access-codes/verify`: 正常 / 期限切れ / 不正コード。
  - Cookie 有無と role に応じた 401 / 403。
- 追加で middleware unit test を補強しても良い。

### 3. ドキュメント更新
- `apps/backend/README.md`, `apps/frontend/README.md`, または `docs/` に以下を明記:
  - backend/frontend 双方で同じ `JWT_SECRET` が必要。
  - ローカルでは `.env` or `.dev.vars`、Cloudflare では `wrangler secret put` の手順。
  - デプロイ前チェックリストとして `wrangler secret` の確認方法。

## 完了条件
- `apps/frontend` と `apps/backend` で `bun run type-check`, `bun run lint`, `bun run test` が通過。
- README 等で secret セットアップが再現可能。
- PR にはテスト結果とドキュメント更新が含まれる。
