# Phase 5 タスク: メール検証 + OTPログイン + 信頼デバイス + Email Worker分離

## 目的

- ユーザー作成時にメールアドレスの有効性を確認できるようにする
- ログイン時に 6 桁 OTP をメール送信し、OTP 認証後にログイン完了とする
- 「このデバイスを信頼する」を実装し、30日間は OTP をスキップできるようにする
- メール送信処理を専用の Email Worker に分離し、Backend Worker から Service Binding で呼び出す

## 実装方針

- 実装順序は `Backend実装 -> Backendテスト -> Frontend実装 -> Frontendテスト` を厳守
- Backend Worker はメール送信を直接行わず、`EMAIL_WORKER` binding 経由で専用 Worker に委譲
- メール検証コードとログイン OTP は 6 桁、10 分有効、再送クールダウン 60 秒、最大失敗 5 回
- 厳密な失敗回数は DB で原子的に管理し、Cloudflare Rate Limiting binding は大量送信・大量試行の抑止に併用
- コードは `OTP_HASH_SECRET` を鍵とする HMAC-SHA-256 で保存し、単純な SHA-256 は使用しない
- メール検証再送 API はアカウント状態と配送成否にかかわらず同じ `202` と本文を返す
- 信頼デバイスは 30 日有効、期限切れまたは照合失敗で OTP を再要求

## Task 1: インフラと Worker 構成

対象:

- `apps/email-worker` (新規)
- `apps/backend/wrangler.jsonc`
- `apps/backend/src/db/connection.ts` など Env 型定義
- 必要に応じて `terraform/` 配下

作業:

1. Cloudflare Email Sending で `reitaisai.info` と dev 用サブドメインを送信ドメインとして有効化する
2. Email Worker に `send_email` binding、必要な secrets/vars を設定する
3. Backend Worker に `services` binding を追加し、`EMAIL_WORKER` として email-worker を参照する
4. dev/prod の service 名を環境ごとに分離する
5. Email Worker を `workers_dev: false` にして公開 URL を無効化する
6. `wrangler types` で binding/runtime 型を生成し、CI で差分を検証する
7. Backend Worker にメール認証 API 用の送信元/アカウント単位 `ratelimits` binding を
   dev/prod 別 namespace で追加する
8. `OTP_HASH_SECRET` を backend の Workers Secret として dev/prod に設定する

完了条件:

- backend から email-worker へ service binding 経由で HTTP 呼び出しできる
- Email Sending の送信ドメインと `send_email` binding が一致している
- メール認証 API 用の rate limit binding と HMAC 用 secret が環境別に利用できる
- 任意宛先への送信が可能な Workers Paid plan であることを確認できている

## Task 2: DB スキーマとリポジトリ拡張

対象:

- `apps/backend/src/db/schema.ts`
- `apps/backend/src/infrastructure/repositories/**`
- `apps/backend/drizzle/*`

作業:

1. `users` に `email_verified_at` を追加
2. `email_verification_tokens` を追加（code HMAC, expires_at, attempts,
   consumed_at, invalidated_at）
3. `login_otp_challenges` を追加（code HMAC, expires_at, attempts,
   completed_at, invalidated_at）
4. `trusted_devices` を追加（device token hash, expires_at, last_used_at）
5. Drizzle migration を生成し、CockroachDB で適用確認する

完了条件:

- migration がローカルと CI 相当環境で成功する
- リポジトリ層でトークン/チャレンジ/信頼デバイスを CRUD できる
- メール検証とログイン OTP の照合・失敗回数加算・無効化を原子的に更新できる

## Task 3: Backend API (認証フロー)

対象:

- `apps/backend/src/presentation/routes/authRoutes.ts`
- `apps/backend/src/presentation/controllers/authController.ts`
- `apps/backend/src/use-cases/auth/**`
- `apps/backend/src/infrastructure/validators/**`

作業:

1. Web Crypto でユーザー登録用の 6 桁コードを生成し、HMAC 保存と送信要求を追加
2. `POST /api/auth/email/verify/request` を追加し、存在しないメール、検証済み、
   クールダウン中、配送失敗を含めて同一の `202` と本文を返す
3. `POST /api/auth/email/verify/confirm` を追加し、5 回失敗で challenge を無効化する
4. `POST /api/auth/login` を「パスワード検証 + OTPチャレンジ発行」に変更
5. `POST /api/auth/login/otp` を追加し、5 回失敗で challenge を無効化し、成功時に `auth_token` を発行
6. `trustDevice=true` なら `trusted_device` Cookie を発行（30日）
7. 信頼デバイス有効時は OTP をスキップできるようにする
8. メール検証/OTP API に送信元とアカウント/challenge の二層の rate limit を適用する
9. コード照合、失敗回数加算、成功/無効化更新を DB 上で原子的に実行する

完了条件:

- 未検証メールではログイン完了できない
- OTP 未入力では `auth_token` が発行されない
- メール検証と OTP は並行リクエストを含めて 5 回失敗後に照合できない
- メール検証再送 API のレスポンスからアカウント状態を判別できない
- rate limit 超過時は `Retry-After` 付きの `429` を返す
- 信頼デバイス有効時は 30 日間 OTP をスキップできる

## Task 4: Email Worker API

対象:

- `apps/email-worker/src/index.ts`
- `apps/email-worker/src/templates/**`（必要なら新規）

作業:

1. backend から受け取る内部 API (`/internal/email/send`) を実装
2. テンプレート種別を最低 2 つ実装（メール検証 / OTP）
3. 送信元ドメイン検証、宛先・件名・本文のバリデーションを実装
4. SendEmail エラー時のログ・再試行方針を明確化する
5. 内部 API の payload を `{ to, template, code }` に固定する

完了条件:

- backend から email-worker を呼ぶだけで検証メール/OTPメールが送信できる
- エラー時に backend へ失敗を返し、監視可能なログが残る

## Task 5: Frontend 認証 UI

対象:

- `apps/frontend/app/register/page.tsx`
- `apps/frontend/app/login/**`（必要に応じて新規）
- `apps/frontend/app/utils/client.ts`

作業:

1. 登録後にメール検証コード入力 UI を表示
2. ログインを 2 ステップ化（パスワード入力 -> OTP入力）
3. OTP 画面に「このデバイスを信頼する（30日）」を追加
4. OTP 再送カウントダウン（60秒）を実装

完了条件:

- 正常系: 登録 -> 検証 -> ログイン -> OTP -> 完了 が通る
- 信頼デバイスを選んだ次回ログインで OTP スキップが機能する

## Task 6: テスト

対象:

- `apps/backend/tests/**`
- `apps/email-worker/tests/**`
- `apps/frontend/tests/**`
- `.github/workflows/pull-request.yml`

作業:

1. Backend Feature Test: `email/verify/request`, `email/verify/confirm`, `login`, `login/otp` の正常系/異常系を追加
2. Backend Unit Test: use-case と repository の失敗系（期限切れ、試行回数超過、クールダウン、並行更新）を追加
3. Email Worker Unit Test: テンプレート生成、入力バリデーション、送信失敗ハンドリングを追加
4. Frontend Test: OTP フロー、再送クールダウン、信頼デバイス UI を追加
5. Backend-EmailWorker 連携テスト: service binding 呼び出しをモックして送信委譲を確認
6. CI ワークフローで backend/frontend/email-worker の lint/type-check/test を実行する
7. HMAC の用途/challenge 分離、アカウント列挙防止、二層 rate limit をテストする

完了条件:

- backend / email-worker / frontend の type-check, lint, test がすべて通る
- コードを平文または単純な SHA-256 で保存しないことをテストで確認できる
- メール検証/OTP の厳密な 5 回制限と rate limit を確認できる
- CI の想定ジョブで失敗しない

### Task 6 テストケース一覧

#### Backend Feature Test

- `BE-FEAT-001`: `POST /api/auth/email/verify/request` 正常系（未検証ユーザーへ再送、202）
- `BE-FEAT-002`: `POST /api/auth/email/verify/request` は存在しないメール、検証済み、
  クールダウン中、配送失敗でも正常系と同一の 202/本文を返す。送信不要な状態では
  メールを送信せず、配送失敗は機密情報を含まないログ/メトリクスにだけ記録する
- `BE-FEAT-003`: `POST /api/auth/email/verify/confirm` 正常系（正しいコード）
- `BE-FEAT-004`: `POST /api/auth/email/verify/confirm` 異常系（期限切れ/不正コード）
- `BE-FEAT-005`: `POST /api/auth/login` OTP 必須分岐（challenge 発行）
- `BE-FEAT-006`: `POST /api/auth/login` 信頼デバイス分岐（OTP スキップ）
- `BE-FEAT-007`: `POST /api/auth/login/otp` 正常系（auth_token 発行）
- `BE-FEAT-008`: `POST /api/auth/login/otp` 異常系（誤入力 5 回で無効化）
- `BE-FEAT-009`: `POST /api/auth/email/verify/confirm` は誤入力 5 回で無効化し、
  並行リクエストでも上限を超えて照合しない
- `BE-FEAT-010`: メール検証/OTP API は送信元とアカウント/challenge の
  rate limit 超過時に `Retry-After` 付き 429 を返す

#### Backend Unit Test

- `BE-UNIT-001`: OTP コード期限判定（10分）
- `BE-UNIT-002`: OTP 再送クールダウン判定（60秒）
- `BE-UNIT-003`: 信頼デバイス有効期限判定（30日）
- `BE-UNIT-004`: メール検証コード HMAC 照合と consumed 更新
- `BE-UNIT-005`: `purpose`, `challengeId`, `userId` が異なる HMAC は一致しない
- `BE-UNIT-006`: メール検証/OTP の失敗回数加算と無効化が原子的に行われる
- `BE-UNIT-007`: rate limit のアカウントキーは正規化メールの HMAC で、
  アカウントの存在有無に依存しない

#### Email Worker Unit Test

- `EW-UNIT-001`: `email_verification` テンプレート生成
- `EW-UNIT-002`: `login_otp` テンプレート生成
- `EW-UNIT-003`: 6桁以外コード入力時のバリデーションエラー
- `EW-UNIT-004`: リクエストボディ不正時の 400 応答
- `EW-UNIT-005`: SendEmail 失敗時のエラー応答とログ出力

#### Frontend Test

- `FE-UNIT-001`: ログイン2ステップ（password -> otp）遷移
- `FE-UNIT-002`: OTP 再送クールダウン表示（60秒）
- `FE-UNIT-003`: OTP エラー表示（不正/期限切れ）
- `FE-UNIT-004`: 「このデバイスを信頼する（30日）」チェックの送信
- `FE-UNIT-005`: 信頼デバイス有効時の OTP 画面スキップ

#### Integration / CI

- `INT-001`: backend -> email-worker の service binding 呼び出し成功
- `INT-002`: 公開 URL なし（`workers_dev: false`）で外部から直接呼び出せない
- `CI-001`: `apps/backend` lint/type-check/test 成功
- `CI-002`: `apps/email-worker` lint/type-check/test 成功
- `CI-003`: `apps/frontend` lint/type-check/test 成功

### Task 6 実行コマンド

```bash
# backend
cd apps/backend
bun run lint
bun run type-check
bun run test

# email-worker
cd apps/email-worker
bun run lint
bun run type-check
bun run test

# frontend
cd apps/frontend
bun run lint
bun run type-check
bun run test
```
