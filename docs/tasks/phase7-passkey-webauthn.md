# Phase 7: パスキー（WebAuthn）導入

## 対象

- `docs/development-guide.md`
- `docs/pages/01-login.md`
- `docs/pages/10-dashboard.md`

## 目的

`user` / `admin` の全ログインユーザー向けにパスキー（WebAuthn）を導入し、
既存のメールアドレス + パスワードログインと併用できるようにする。

## ライブラリ選定

### 採用

1. backend: `@simplewebauthn/server`
   - WebAuthn の options 生成とレスポンス検証を提供
   - `verifyRegistrationResponse()` / `verifyAuthenticationResponse()` により
     challenge, origin, RP ID, 署名, counter 検証を一元化できる
2. frontend: `@simplewebauthn/browser`
   - `startRegistration()` / `startAuthentication()` で
     WebAuthn のブラウザ差異を吸収できる
3. バリデーション: 既存の `zod` を継続利用
   - API 入出力のスキーマ検証を既存実装方針に統一する

### 不採用（今回）

1. 生の `navigator.credentials.create/get` のみでフル実装
   - 署名検証や CBOR/attestation 処理の自前実装コストが高く、保守リスクが大きい
2. Cloudflare Access 前段化での認証統合
   - 既存 `auth_token` ベースの認証設計からの変更範囲が大きく、
     Phase7（パスキー導入）ではスコープ外

## 追加依存関係（予定）

### backend (`apps/backend`)

- `@simplewebauthn/server`

### frontend (`apps/frontend`)

- `@simplewebauthn/browser`

## Cloudflare Workers 前提条件

1. `nodejs_compat` を有効化する（現状構成を維持）
2. WebAuthn 検証で必要な Node/WebCrypto API が利用可能であることを
   事前 PoC で確認する
3. 互換性検証は `wrangler dev` / `preview` 環境で行い、
   Node 実行前提のローカル差異を吸収する

## 実装順序

backend と frontend をまたぐため、以下の順序を厳守する。

1. Backend 実装
2. Backend テスト
3. Frontend 実装
4. Frontend テスト

## 実装内容

1. `webauthn_credentials` テーブルを追加する
   - 例: `id`, `user_id`, `credential_id`, `public_key`, `counter`, `transports`, `created_at`, `updated_at`
   - `credential_id` は一意制約を付与する
2. Drizzle migration を作成し、既存の `users` との外部キー制約を設定する
3. challenge 一時保存用テーブルを追加する
   - 例: `webauthn_challenges`
   - カラム例: `id`, `user_id(nullable)`, `flow_type(register|authenticate)`, `challenge`, `expires_at`, `created_at`
   - TTL 方針: 5 分で失効、verify 完了時に即時削除
4. backend にパスキー登録 API を追加する
   - `POST /api/auth/passkey/register/options`
   - `POST /api/auth/passkey/register/verify`
5. backend にパスキーログイン API を追加する
   - `POST /api/auth/passkey/authenticate/options`
   - `POST /api/auth/passkey/authenticate/verify`
6. `@simplewebauthn/server` の options / verify を use-case 層に実装する
   - options: `generateRegistrationOptions()` / `generateAuthenticationOptions()`
   - verify: `verifyRegistrationResponse()` / `verifyAuthenticationResponse()`
7. `authenticate/verify` 成功時は既存ログインと同様に `auth_token` Cookie を発行する
8. 既存の `POST /api/auth/login` はそのまま維持し、パスキーと併用可能にする
9. WebAuthn 設定値（RP ID / origin）を環境別に管理する
   - prod: `reitaisai.info`
   - dev: `dev.reitaisai.info`
   - local: `localhost`
10. `/login` に「パスキーでログイン」導線を追加する
11. `/dashboard` に「パスキー登録 / 一覧 / 削除」UI を追加する
12. frontend は `@simplewebauthn/browser` を利用して challenge レスポンスを backend に送信する
13. 未対応ブラウザ、操作キャンセル、challenge 期限切れなどの失敗ケースを UI で明示する

## API 契約（詳細）

1. `POST /api/auth/passkey/register/options`
   - 認証済みユーザーのみ
   - 返却: `PublicKeyCredentialCreationOptionsJSON`
2. `POST /api/auth/passkey/register/verify`
   - リクエスト: `RegistrationResponseJSON`
   - 成功時: credential 保存、`{ verified: true }`
3. `POST /api/auth/passkey/authenticate/options`
   - 未ログインユーザー向け
   - リクエストにログイン識別子（email など）を受け、候補 credential を解決
   - 返却: `PublicKeyCredentialRequestOptionsJSON`
4. `POST /api/auth/passkey/authenticate/verify`
   - リクエスト: `AuthenticationResponseJSON`
   - 成功時: `auth_token` 発行、`{ verified: true }`

## セキュリティ要件（詳細）

1. challenge はワンタイム利用（verify 後に削除）
2. challenge と flow_type（register/authenticate）を厳密に一致確認
3. `expectedOrigin` / `expectedRPID` は環境別設定を使用
4. 認証成功時は credential の `counter` を必ず更新
5. 同一ユーザーの credential 上限数（例: 5）を設定して濫用を防止
6. 監査ログに登録/削除/認証成功失敗を記録（平文 credential データは残さない）

## このフェーズでやらないこと

- パスワードログインの廃止
- パスキー必須化
- 外部 IdP（Google / Apple など）の導入

## テスト

### Backend

- register/options が認証ユーザーに対して challenge を返す
- register/verify 成功で credential が保存される
- authenticate/options がログイン対象に対して challenge を返す
- authenticate/verify 成功で `auth_token` が発行される
- 不正 challenge、credential 不一致、署名不正、counter 異常時に認証失敗する
- challenge の期限切れ・再利用を拒否する
- credential 上限超過時を拒否する
- 既存 `POST /api/auth/login` の挙動が回帰しない

### Frontend

- `/login` で「パスキーでログイン」導線が表示される
- パスキーログイン成功時に既存と同様の遷移が行われる
- `/dashboard` でパスキー登録 / 一覧 / 削除が操作できる
- WebAuthn 未対応 / キャンセル / 失敗時のメッセージが表示される
- 既存のパスワードログイン導線が維持される

## 完了条件

- 全ログインユーザーがパスワードまたはパスキーでログインできる
- `auth_token` を利用する既存のアクセス制御（middleware / role 判定）に変更を加えず動作する
- 環境別の RP ID / origin 設定で dev / prod / local それぞれの認証が成立する
- `apps/backend` の `type-check`, `test`, `lint` が通る
- `apps/frontend` の `type-check`, `test`, `lint` が通る
- `docs/development-guide.md` と関連 `docs/pages` が Phase 7 仕様に追従している
