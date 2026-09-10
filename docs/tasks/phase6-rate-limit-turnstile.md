# Phase 6: アクセスコード/ログインの総当たり対策（Rate Limiting + Turnstile）

> **最優先タスク。** `POST /api/access-codes/verify` が無制限で総当たり可能な現状の穴を塞ぐ。
> 進行中の Phase 5（メール認証 / [PR #167](https://github.com/RTS-souhon/BasicKnowledgeForWeb/pull/167)）の直後に着手する。

## 対象

- `apps/backend/wrangler.jsonc`
- `apps/backend/src/db/connection.ts`（`Env` 型）
- `apps/backend/src/presentation/routes/accessCodeRoutes.ts`
- `apps/backend/src/presentation/routes/authRoutes.ts`
- `apps/backend/src/presentation/routes/userRoutes.ts`
- `apps/backend/src/presentation/controllers/accessCodeController.ts`
- `apps/backend/src/presentation/controllers/authController.ts`
- `apps/backend/src/presentation/controllers/userController.ts`
- `apps/backend/src/presentation/middleware/`（レート制限ヘルパを追加）
- `apps/backend/src/infrastructure/validators/`（Turnstile トークン項目を追加）
- `apps/frontend/app/access/page.tsx` / `login/page.tsx` / `register/page.tsx`
- `docs/pages/01-login.md` / `02-register.md` / `03-access.md`

## 背景・目的

`POST /api/access-codes/verify` は「誰でも可」（`accessCodeRoutes.ts`）かつ回数制限がなく、
アクセスコードの **総当たり** が可能。`POST /api/auth/login` も同様にブルートフォース対象。

以下 2 層の防御を導入する。

1. **Workers Rate Limiting バインディング**（`ratelimit`、2025-09 GA）でサーバー側の回数制限
2. **Turnstile** でフォーム経由のボット/自動送信を抑止

ゾーンレベルの WAF レート制限ルールは [Phase 10-2（境界防御・計測）](./phase10-2-waf-analytics.md) で別途追加し、多層防御とする。

> **Phase 5（メール認証 / PR #167）との関係:** Phase 5 で追加される OTP ログインやメール検証の
> verify 系エンドポイント（特に数桁 OTP）は総当たりの典型的な標的になる。Phase 5 がマージされたら、
> 本タスクの Rate Limiting / Turnstile 保護対象に OTP・メール検証エンドポイントを追加すること。

## 実装順序

backend と frontend をまたぐため、以下の順序を厳守する。

1. Backend 実装（Rate Limiting）
2. Backend テスト
3. Backend 実装（Turnstile siteverify）
4. Backend テスト
5. Frontend 実装（Turnstile ウィジェット）
6. Frontend テスト

## 実装内容

### A. Workers Rate Limiting

1. `apps/backend/wrangler.jsonc` に `ratelimits` バインディングを追加する（dev/prod 両方）。例（**prod**）:
   ```jsonc
   "ratelimits": [
     { "name": "ACCESS_CODE_LIMITER", "namespace_id": "2001", "simple": { "limit": 10, "period": 60 } },
     { "name": "LOGIN_LIMITER",       "namespace_id": "2002", "simple": { "limit": 10, "period": 60 } }
   ]
   ```
   - 設定キーは **`ratelimits`（複数形）**。単数形 `ratelimit` ではバインディングが生成されず、`env.ACCESS_CODE_LIMITER` などが未定義になる。
   - **`namespace_id` は環境ごとに変える。** 公式仕様上、同一 `namespace_id` は**別 Worker（dev/prod）間でもカウンタを共有する**。共有を避けるため dev は `1001`/`1002`、prod は `2001`/`2002` のように分ける。
   - `period` は **10 または 60 秒**のみ指定可。
   - 最新の必須フィールド・構文は公式ドキュメントで確認する: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
2. `connection.ts` の `Env` 型にレート制限バインディング（`{ limit(opts: { key: string }): Promise<{ success: boolean }> }`）を追加する。
3. `presentation/middleware/` にレート制限ヘルパ/ミドルウェアを追加し、route から DI できる形にする（Feature テストで差し替え可能にする）。
4. verify / login のハンドラ先頭でレート制限を評価し、`success === false` のとき **429** を返す（`Retry-After` ヘッダーを付与）。
   - **キーは「アクセス元（actor）」で構成し、入力値（アクセスコード / メール）をキーに含めない。** 入力値を含めると、攻撃者が値を変えるたびに別カウンタが割り当たり、総当たり（列挙）を素通しさせてしまう。基本キーは `CF-Connecting-IP`（+ ルート識別子）とする。
   - 必要に応じて **第2のリミッタ**（アクセスコード単位 / アカウント単位）を追加し、単一ターゲットへの分散試行にも上限を設ける。
   - 注意: 公式は「IP は多数ユーザーで共有され得る」ため IP 単独キーを非推奨としている（会場のモバイル回線では特に顕著）。IP のしきい値は緩めに取り、ボット遮断は Turnstile 側に委ねて正規ユーザーの誤ロックを避ける。

### B. Turnstile

5. Cloudflare ダッシュボードで Turnstile ウィジェットを作成し、site key（公開）と secret を発行する。secret は Workers Secret `TURNSTILE_SECRET` として管理する（`wrangler.jsonc` には置かない）。
6. backend: **verify / login / 登録（`POST /api/users`）** の入力に `cf-turnstile-response`（トークン）を必須項目として追加（共有 Zod スキーマを拡張）。siteverify エンドポイント `https://challenges.cloudflare.com/turnstile/v0/siteverify` を呼び、検証失敗時は **400** を返す。**フロントの 3 フォームすべてに対応するサーバー側検証を用意し**、ウィジェットだけで未検証の経路（`POST /api/users` を直接叩く等）を残さない。
7. frontend: `/access`・`/login`・`/register` に Turnstile ウィジェットを設置し、取得したトークンを送信ペイロードに含める。`react-hook-form` + 共有 Zod スキーマと整合させる。

## このフェーズでやらないこと

- 全 API への一律レート制限（必要箇所に限定する）
- WAF レベルのレート制限ルール（[Phase 10-2](./phase10-2-waf-analytics.md) で実施）
- ログイン / アクセスコード / 登録**以外**のフォーム（パスワード変更・ロール変更など）への Turnstile 適用（Phase 5 OTP は上記の通りマージ後に追加）

## テスト

### Backend

- レート制限超過時に `429`（`Retry-After` 付き）を返す
- 制限内では従来どおり処理が通過する
- verify / login / 登録で `cf-turnstile-response` 欠落時に `400` を返す
- verify / login / 登録で siteverify 失敗時に `400` を返す
- レート制限キーに入力値が含まれず、同一 IP から異なるアクセスコードを試しても回数が累積する（列挙が素通ししない）
- 既存の verify / login / 登録 正常系・異常系が回帰しない（`auth-hardening-tests` 観点を維持）

### Frontend

- `/access`・`/login`・`/register` でウィジェットが表示される
- トークン未取得では送信できない（バリデーション）
- 成功時は従来どおり遷移する
- siteverify 失敗時にエラーメッセージが表示される

## コスト

Workers Rate Limiting・Turnstile とも **無料**。

## 完了条件

- `verify` / `login` が「回数制限 + Turnstile」で、登録（`POST /api/users`）が Turnstile で保護される
- `apps/backend` の `type-check`, `test`, `lint` が通る
- `apps/frontend` の `type-check`, `test`, `lint` が通る
- `docs/pages` の認証系ページ仕様が本対応に追従している
