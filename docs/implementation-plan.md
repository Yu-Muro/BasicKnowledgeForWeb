# 実装プラン: メール検証 + OTP認証 + 信頼デバイス + Email Worker

## ゴール

- ユーザー作成時にメールアドレスを検証し、未検証ユーザーの認証を制限する
- ログインを二段階化し、6桁OTPで本人確認する
- 信頼デバイスを 30 日保持し、再ログイン時の OTP を省略できるようにする
- メール送信責務を Email Worker に分離し、Backend Worker は Service Binding で呼び出す

## アーキテクチャ

### Worker 構成

- Frontend Worker (`apps/frontend`)
- Backend Worker (`apps/backend`)
- Email Worker (`apps/email-worker`)

### Binding 構成

- Frontend -> Backend: 既存 `BACKEND` service binding
- Backend -> Email Worker: 新規 `EMAIL_WORKER` service binding
- Email Worker -> Cloudflare Email Sending: `send_email` binding
- Backend: メール認証 API 用の送信元/アカウント単位 `ratelimits` binding

### Cloudflare 前提条件

- 任意のユーザー宛メール送信が可能な Workers Paid plan を使用する
- `reitaisai.info` を Email Sending の送信ドメインとして有効化する
- dev で `noreply@dev.reitaisai.info` を使う場合は、サブドメインも個別に有効化する
- Email Routing のみの場合は検証済み Destination Address にしか送信できないため、
  登録確認・OTP 用には Email Sending を使用する
- Backend からは Service Binding、Email Worker からは `send_email` binding を使い、
  Worker 間通信やメール送信のための API Token をアプリへ持たせない

### 通信方針

- Backend から Email Worker へ `fetch()` で内部 API を呼ぶ
- Email Worker は Service Binding 経由の呼び出し専用とする
- Email Worker は `workers_dev: false` とし、公開 URL を持たせない

## 認証フロー

### 1. ユーザー登録 + メール検証

1. `POST /api/users` でユーザー作成（`email_verified_at = null`）
2. Backend が Web Crypto で 6 桁の検証コードを生成し、HMAC のみ保存
3. Backend が `EMAIL_WORKER` へ送信依頼
4. Email Worker が検証メール送信
5. ユーザーが `POST /api/auth/email/verify/confirm` でコード送信
6. 照合と失敗回数加算を原子的に行い、5 回失敗で challenge を無効化
7. 成功時に `users.email_verified_at` を更新

### 2. ログイン + OTP

1. `POST /api/auth/login` で email/password を検証
2. メール未検証なら 401（または 403）で拒否
3. 信頼デバイスが有効なら OTP をスキップし `auth_token` 発行
4. 信頼デバイスが無効なら OTP challenge を生成しメール送信
5. クライアントは `POST /api/auth/login/otp` に challenge と OTP を送信
6. 成功時に `auth_token` 発行、`trustDevice=true` なら `trusted_device` Cookie 発行

## データモデル

### users 追加カラム

- `email_verified_at timestamp null`

### email_verification_tokens

- `id uuid pk`
- `user_id uuid fk -> users.id`
- `code_hash text not null`
- `expires_at timestamp not null`
- `attempts int not null default 0`
- `consumed_at timestamp null`
- `invalidated_at timestamp null`
- `created_at timestamp default now`

### login_otp_challenges

- `id uuid pk`
- `user_id uuid fk -> users.id`
- `code_hash text not null`
- `expires_at timestamp not null`
- `attempts int not null default 0`
- `completed_at timestamp null`
- `invalidated_at timestamp null`
- `created_at timestamp default now`

### trusted_devices

- `id uuid pk`
- `user_id uuid fk -> users.id`
- `device_token_hash text not null`
- `user_agent_hash text null`
- `ip_hash text null`
- `expires_at timestamp not null`
- `last_used_at timestamp default now`
- `created_at timestamp default now`

## API 追加/変更

### 追加

- `POST /api/auth/email/verify/request`
- `POST /api/auth/email/verify/confirm`
- `POST /api/auth/login/otp`

### 変更

- `POST /api/auth/login`
  - 変更前: 成功時に即 `auth_token` 発行
  - 変更後: OTP が必要な場合は challenge 発行レスポンスを返却

### Email Worker 内部 API

- `POST /internal/email/send`
  - payload: `{ "to": string, "template": string, "code": string }`
  - template: `email_verification` | `login_otp`

## セキュリティ要件

- メール検証コードとログイン OTP は 6 桁、10 分有効、60 秒再送制限、5 回失敗で無効化
- 6 桁コードの生成には `crypto.getRandomValues()` を使用し、`Math.random()` は使用しない
- 6 桁コードは平文や単純な SHA-256 で保存せず、Workers Secret
  `OTP_HASH_SECRET` を鍵とする HMAC-SHA-256 を保存する
- HMAC の入力には `purpose`, `challengeId`, `userId`, `code` を含め、用途や
  challenge をまたいだ再利用を防ぐ。照合には Web Crypto の `verify()` を使用する
- `OTP_HASH_SECRET` は `JWT_SECRET` と分離し、dev/prod で別値にする。ローテーション時は
  有効期間が最大 10 分の既存 challenge を失効させる
- コード照合、失敗回数加算、成功/無効化更新は DB 上で原子的に行い、並行リクエストでも
  5 回の上限を超えて照合できないようにする
- メール検証/OTP API は公開時点から送信元とアカウント/challenge の二層で制限する。
  Cloudflare Rate Limiting binding は局所的かつ eventual consistency のため、厳密な
  5 回制限は DB を正とし、binding は大量送信・大量試行の抑止に使う
- メールアドレスを rate limit key に使う場合は、正規化した値の HMAC を使用し、
  ログやメトリクスへ平文を残さない
- `POST /api/auth/email/verify/request` はメールの存在、検証済み状態、クールダウン状態、
  配送成否にかかわらず同じ `202` と同じ本文を返し、アカウント列挙を防ぐ。
  配送失敗は機密情報を含まない構造化ログとメトリクスで監視する
- `trusted_device` Cookie は `HttpOnly`, `Secure`, `SameSite=Lax`
- 信頼デバイス有効期限は 30 日
- 信頼デバイストークンは Web Crypto で 256 bit 以上を生成し、DB には SHA-256 hash のみ保存する
- 内部 API は service binding を前提にし、email-worker は公開 URL を持たない
- Email Sending 失敗時は機密情報をログへ出さず `502` を返し、Worker 内で自動再試行しない

## 実装ステップ

1. Cloudflare Email Sending で prod/dev の送信ドメインを有効化
2. `apps/email-worker` を作成し、内部送信 API を実装
3. backend wrangler に `EMAIL_WORKER` service binding を追加
4. backend wrangler にメール認証 API 用 `ratelimits` binding を環境別に追加
5. DB schema/migration を追加
6. backend repository/use-case/controller/routes を更新
7. frontend の register/login UI を更新
8. backend/frontend/email-worker のテストを追加
9. dev 環境で e2e 相当の手動検証

## 完了定義

- 仕様どおりメール検証と OTP ログインが機能する
- メール検証と OTP の両方で、5 回の厳密な失敗上限と rate limit が機能する
- メール検証再送 API のレスポンスからアカウント状態を判別できない
- 信頼デバイス 30 日が機能し、期限切れ後に OTP が再要求される
- backend/frontend/email-worker の `type-check`, `lint`, `test` が成功する
- CI と Cloudflare dev デプロイで動作確認が取れる
