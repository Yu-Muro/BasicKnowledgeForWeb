# Phase 5 実装チェックリスト

## 1. Infrastructure / Cloudflare

- [ ] `apps/email-worker` が作成されている
- [ ] Email Worker に `send_email` binding が設定されている
- [ ] `apps/backend/wrangler.jsonc` に `EMAIL_WORKER` service binding がある
- [ ] dev/prod で service 名が環境別に設定されている
- [ ] Email Worker の `workers_dev` が `false` で公開 URL が無効化されている
- [ ] `wrangler types` で生成した binding/runtime 型がコミットされている
- [ ] Backend にメール認証 API 用の送信元/アカウント単位 `ratelimits` binding がある
- [ ] rate limit の `namespace_id` が dev/prod で分離されている
- [ ] HMAC 用 `OTP_HASH_SECRET` が `JWT_SECRET` と分離され、dev/prod の Workers Secret に設定されている
- [ ] Workers Paid plan で任意宛先への Email Sending が利用可能になっている
- [ ] Email Sending で `reitaisai.info` が送信ドメインとして有効化されている
- [ ] dev 送信元を使う場合は `dev.reitaisai.info` も個別に有効化されている
- [ ] 送信ドメインの `cf-bounce` MX、SPF、DKIM、DMARC が有効になっている

## 2. Database

- [ ] `users.email_verified_at` が追加されている
- [ ] `email_verification_tokens` テーブルが追加されている
- [ ] `login_otp_challenges` テーブルが追加されている
- [ ] `trusted_devices` テーブルが追加されている
- [ ] メール検証 challenge に `attempts` と `invalidated_at` がある
- [ ] ログイン OTP challenge に `attempts` と `invalidated_at` がある
- [ ] Drizzle migration が生成済み
- [ ] CockroachDB で migration 適用成功

## 3. Backend API

- [ ] ユーザー登録でメール検証トークンが発行される
- [ ] `POST /api/auth/email/verify/request` が実装されている
- [ ] メール検証再送は存在/検証済み/クールダウン/配送成否にかかわらず同一の `202` と本文を返す
- [ ] `POST /api/auth/email/verify/confirm` が実装されている
- [ ] `POST /api/auth/login` が OTP challenge 方式に変更されている
- [ ] `POST /api/auth/login/otp` が実装されている
- [ ] 6桁コードは Web Crypto で生成し、`OTP_HASH_SECRET` を鍵とする HMAC-SHA-256 のみ保存する
- [ ] HMAC 入力に `purpose`, `challengeId`, `userId`, `code` が含まれている
- [ ] コード照合と失敗回数加算が原子的で、メール検証/OTPとも5回失敗で無効化される
- [ ] メール検証/OTP API に送信元とアカウント/challenge の二層 rate limit がある
- [ ] rate limit のアカウントキーに平文メールアドレスを使用していない
- [ ] `trustDevice` 指定時に 30 日有効 Cookie が発行される
- [ ] 信頼デバイス有効時は OTP をスキップできる

## 4. Email Worker

- [ ] `POST /internal/email/send` が実装されている
- [ ] 内部 API の payload が `{ to, template, code }` で Backend の契約と一致している
- [ ] `email_verification` テンプレートが実装されている
- [ ] `login_otp` テンプレートが実装されている
- [ ] Service Binding 経由呼び出し前提で実装されている
- [ ] 送信失敗時にログとエラーレスポンスが返る

## 5. Frontend

- [ ] register 後のメール検証コード入力 UI がある
- [ ] login が 2 ステップ（password -> otp）になっている
- [ ] 「このデバイスを信頼する（30日）」UI がある
- [ ] OTP 再送クールダウン（60秒）が実装されている
- [ ] API エラー時にユーザー向けメッセージが表示される

## 6. Test / Quality

- [ ] backend `bun run type-check` 成功
- [ ] backend `bun run lint` 成功
- [ ] backend `bun run test` 成功
- [ ] backend Feature Test に `POST /api/auth/email/verify/request` の正常系/異常系がある
- [ ] backend Feature Test で存在しないメール/検証済み/クールダウン中/配送失敗も同一の 202/本文になる
- [ ] backend Feature Test に `POST /api/auth/email/verify/confirm` の正常系/期限切れ/不正コードがある
- [ ] backend Test にメール検証コードの誤入力5回と並行試行時の無効化がある
- [ ] backend Feature Test に `POST /api/auth/login` と `POST /api/auth/login/otp` の分岐（OTP必須/スキップ）がある
- [ ] backend Test に OTP の試行回数超過（5回）と再送クールダウン（60秒）がある
- [ ] backend Test に HMAC の用途/challenge/user 分離と単純ハッシュ不使用の検証がある
- [ ] backend Test に二層 rate limit の 429/`Retry-After` とキー生成の検証がある
- [ ] email-worker `bun run type-check` 成功
- [ ] email-worker `bun run lint` 成功
- [ ] email-worker `bun run test` 成功
- [ ] email-worker Test にテンプレート生成（`email_verification` / `login_otp`）の検証がある
- [ ] email-worker Test に送信失敗時ハンドリング（エラー応答/ログ）がある
- [ ] frontend `bun run type-check` 成功
- [ ] frontend `bun run lint` 成功
- [ ] frontend `bun run test` 成功
- [ ] frontend Test に login 2ステップ（password -> otp）とエラー表示がある
- [ ] frontend Test に OTP 再送クールダウン（60秒）の検証がある
- [ ] frontend Test に信頼デバイス 30 日（有効/期限切れ）の検証がある
- [ ] backend-email-worker 間の内部 API 呼び出しをモックした連携テストがある
- [ ] PR CI（`pull-request.yml`）で backend/frontend/email-worker の lint/type-check/test が全て成功する

## 7. Release Readiness

- [ ] PR タイトルと本文が日本語で作成されている
- [ ] 変更内容が Conventional Commits で分割されている
- [ ] Cloudflare dev 環境で実機確認済み
- [ ] 厳密な5回制限と二層 rate limit が有効になるまでメール認証 API を公開しない
- [ ] 本番反映手順とロールバック手順が共有されている
