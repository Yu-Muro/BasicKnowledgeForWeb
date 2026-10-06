# ログイン画面 `/login`

## 概要
- 管理者がメールアドレスとパスワードでログインする画面。
- ログイン成功時は `auth_token` Cookie を受け取り、`/dashboard` に遷移する。
- 一般ユーザーの入口は `/access` を使う想定。

## アクセス制御
- 未ログインでも表示可能。
- 画面自体にロール制限はない。
- 実際の管理機能へのアクセス可否は `auth_token` と `role=admin` で判定される。

## 画面構成
- 入力項目
  - メールアドレス
  - パスワード
- 表示要素
  - バリデーションエラー
  - サーバーエラー
  - `/register` への導線

## フォームバリデーション
- `email`: メール形式必須
- `password`: 1文字以上必須

## 利用 API
### `POST /api/auth/login`
- リクエスト
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```
- 成功時
  - `200 OK`
  - `Set-Cookie: auth_token=...`
  - レスポンス: `{ "message": "ログインしました" }`
- 失敗時
  - `400`: バリデーションエラー
  - `401`: 認証失敗（メールまたはパスワード不一致）
  - `403`: 所属部署未設定 / 不正なOrigin
  - `429`: 試行回数超過
  - `503`: 認証サービス障害

### `GET /api/auth/me`（ログイン状態確認用）
- `auth_token` 必須
- レスポンス: `{ id, name, email, role, departmentId }`

## ログインセッション

`auth_token` はBetter Authの署名付きセッションCookie。有効期限は7日で、自動延長しない。JWTのデコードによるユーザー情報取得は行わず、`/api/auth/me` でDB上の現在のユーザー情報を確認する。導入前のJWTでは再ログインが必要。

## 実装メモ
- フロント: `apps/frontend/app/login/page.tsx`
- バックエンド: `POST /api/auth/login` は `authController.login` が担当
- Cookie は `httpOnly`, `sameSite=Lax`, `maxAge=7日`。HTTPS環境では `secure` を付与する。

## テスト観点
- 正常ログインで `200` と Cookie が返る
- 不正認証で `401`
- バリデーション不正で `400`
- ログイン後に `/dashboard` へ遷移できる
