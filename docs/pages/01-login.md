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

### `GET /api/auth/me`（ログイン状態確認用）
- `auth_token` 必須
- レスポンス: `{ id, name, email, role }`

## JWT ペイロード（`auth_token`）
```json
{
  "id": "user-uuid",
  "name": "管理者",
  "email": "admin@example.com",
  "role": "admin",
  "exp": 1700000000
}
```

## 実装メモ
- フロント: `apps/frontend/app/login/page.tsx`
- バックエンド: `POST /api/auth/login` は `authController.login` が担当
- Cookie は `httpOnly`, `secure`, `sameSite=Lax`, `maxAge=7日`

## テスト観点
- 正常ログインで `200` と Cookie が返る
- 不正認証で `401`
- バリデーション不正で `400`
- ログイン後に `/dashboard` へ遷移できる

## Dev環境の試行回数制限

`PUBLIC_AUTH_RATE_LIMIT_ENABLED=true` の環境では、上記の公開POST APIを
操作ごと・送信元ごと（IPv4はアドレス単位、IPv6は/64プレフィックス単位）に
60秒で60回の近似制限で保護する。
入力値を変えても同じ送信元の試行回数は累積する。

- `429`: 試行回数超過。`Retry-After: 60`、`Cache-Control: no-store`。
- `503`: 制限サービスの障害、binding未設定、信頼できる送信元情報の欠落、不正な送信元IP。
- レスポンスは `{ error: string }`。既存フォームはこのエラーを表示する。
- 現在有効なのはDevのみ。本番・ローカルでは未設定のため従来の動作を維持する。

設定・検証・復旧手順は [Dev環境の防御手順](../manuals/dev-security-hardening.md) を参照。
