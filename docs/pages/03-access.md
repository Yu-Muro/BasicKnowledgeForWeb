# アクセスコード入力画面 `/access`

## 概要
- 一般ユーザーが会期アクセス用コードを入力する画面。
- 成功時に `access_token` Cookie を受け取り、`/` へ遷移する。

## アクセス制御
- 未ログインでも表示可能。
- 管理者ログイン導線として `/login` へのリンクを表示。

## 画面構成
- 入力項目
  - アクセスコード
- 表示要素
  - 入力バリデーションエラー
  - サーバーエラー
  - `/login` への導線

## フォームバリデーション
- `code`: 1文字以上必須

## 利用 API
### `POST /api/access-codes/verify`
- リクエスト
```json
{
  "code": "SUMMER2025"
}
```
- 成功時
  - `200 OK`
  - `Set-Cookie: access_token=...`
  - レスポンス: `{ "message": "アクセスコードを確認しました" }`
- 失敗時
  - `400`: バリデーションエラー
  - `401`: コード不正 / 有効期限外

## JWT ペイロード（`access_token`）
```json
{
  "event_id": "access-code-id(uuid)",
  "exp": 1700000000
}
```

## 実装メモ
- フロント: `apps/frontend/app/access/page.tsx`
- バックエンド: `accessCodeController.verifyAccessCode` + `VerifyAccessCodeUseCase`
- `exp` はアクセスコードの `valid_to` を使用

## テスト観点
- 正しいコードで `200` + Cookie 設定
- 不正コードで `401`
- 期限切れコードで `401`
- 入力不足で `400`

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
