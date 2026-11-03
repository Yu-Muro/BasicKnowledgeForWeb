# Phase 8: Google OIDC ログイン導入（既存認証併用）

## 対象

- `docs/development-guide.md`
- `docs/pages/01-login.md`
- `docs/pages/10-dashboard.md`

## 目的

Google を外部 IdP とした OIDC ログインを追加し、既存の
メールアドレス + パスワード / パスキー認証と併用できるようにする。

認証後のセッションは既存仕様を維持し、`auth_token` を発行して
既存 middleware / RBAC の動作を変更しない。

## 実装順序

backend と frontend をまたぐため、以下の順序を厳守する。

1. Backend 実装
2. Backend テスト
3. Frontend 実装
4. Frontend テスト

## 実装内容

1. Google OIDC 用の環境変数を追加する
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
2. 環境ごとに OAuth クライアントを分離する
   - prod / dev / local で別 client を使用する
3. backend に Google ログイン開始 API を追加する
   - `GET /api/auth/google/start`
   - `state` と PKCE (`code_verifier` / `code_challenge`) を生成・保持する
4. backend に Google コールバック API を追加する
   - `GET /api/auth/google/callback`
   - code 交換、ID トークン検証、`state` 検証を行う
5. ID トークン検証で以下を必須化する
   - `aud` が自アプリの client_id と一致
   - `iss` が Google 正規 issuer
   - `exp` 未期限切れ
6. ユーザー連携方針を実装する
   - Google の `sub` を外部IDとして保存・照合する
   - 既存ユーザーとの紐付けポリシーを定義する（後述）
7. 認証成功時は既存ログインと同様に `auth_token` Cookie を発行する
8. `/login` に「Googleでログイン」導線を追加する
9. 認証失敗（キャンセル / state 不一致 / token 検証失敗）の UI を追加する
10. `/dashboard` に Google 連携状態（連携済み/未連携）を表示する

## ユーザー連携ポリシー（初期案）

1. `google_sub` 一致ユーザーが存在する場合はそのユーザーでログイン成功
2. `google_sub` 未登録で同一 email ユーザーが存在する場合:
   - 初期は「自動連携しない」方針を推奨（乗っ取りリスク低減）
   - 連携確認フロー（既存認証済みでの明示連携）は別タスク化
3. どちらも存在しない場合:
   - 自動新規作成可否を要件で決める（初期は無効推奨）

## このフェーズでやらないこと

- Cloudflare Access 前段化（`Cf-Access-Jwt-Assertion` への全面移行）
- 既存パスワード / パスキーの廃止
- Google Workspace グループ連携による RBAC 自動同期
- 複数 IdP（Microsoft / GitHub など）の同時導入

## テスト

### Backend

- `/api/auth/google/start` が state/PKCE を生成してリダイレクト URL を返す
- `/api/auth/google/callback` 正常系で `auth_token` が発行される
- state 不一致で失敗する
- code 交換失敗 / token 検証失敗で失敗する
- `aud` / `iss` / `exp` の不正トークンを拒否する
- 既存 `POST /api/auth/login` およびパスキー認証の挙動が回帰しない

### Frontend

- `/login` に Google ログイン導線が表示される
- Google ログイン成功時に既存ログイン同様の遷移が行われる
- キャンセル・失敗時に適切なエラー表示が出る
- 既存ログイン導線（パスワード / パスキー）が維持される

## 完了条件

- Google OIDC ログインで `auth_token` を発行し、既存認可フローで画面利用できる
- 既存パスワード / パスキー認証と併用可能である
- 環境別（prod/dev/local）の OAuth 設定で動作する
- `apps/backend` の `type-check`, `test`, `lint` が通る
- `apps/frontend` の `type-check`, `test`, `lint` が通る
- `docs/development-guide.md` と関連 `docs/pages` が Phase 8 仕様に追従している
