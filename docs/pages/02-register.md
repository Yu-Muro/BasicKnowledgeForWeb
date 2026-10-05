# ユーザー登録画面 `/register`

## 概要
- 新規ユーザーを作成する画面。
- 登録成功後は成功メッセージを表示する（自動ログインはしない）。

## アクセス制御
- 未ログインでも表示可能。
- ロール指定がない場合、作成されるユーザーのロールは `user`。

## 画面構成
- 入力項目
  - 名前
  - メールアドレス
  - パスワード
  - パスワード（確認用）
- 表示要素
  - フィールドごとのバリデーションエラー
  - サーバーエラー
  - 登録成功メッセージ

## フォームバリデーション
- バックエンドの `createUserSchema` を再利用
- `confirmPassword` はフロントで追加し、`password` 一致を検証
- 主な制約
  - `name`: 1〜255 文字
  - `email`: メール形式
  - `password`: 8 文字以上

## 利用 API
### `POST /api/users`
- リクエスト
```json
{
  "name": "山田太郎",
  "email": "taro@example.com",
  "password": "password123"
}
```
- 成功時
  - `201 Created`
  - レスポンス: `{ "user": { ... } }`
- 失敗時
  - `400`: バリデーションエラー / メール重複
  - `500`: サーバーエラー

## 実装メモ
- フロント: `apps/frontend/app/register/page.tsx`
- バックエンド: `userController.createUser` + `CreateUserUseCase`
- パスワードはバックエンドでハッシュ化して保存

## テスト観点
- 正常登録で `201`
- 重複メールで `400`
- パスワード不一致（確認用）をフロントで検知
- バリデーションメッセージが表示される

## Dev環境の試行回数制限

`PUBLIC_AUTH_RATE_LIMIT_ENABLED=true` の環境では、上記の公開POST APIを
操作ごと・送信元IPごとに60秒で60回の近似制限で保護する。
入力値を変えても同じ送信元の試行回数は累積する。

- `429`: 試行回数超過。`Retry-After: 60`、`Cache-Control: no-store`。
- `503`: 制限サービスの障害、binding未設定、信頼できる送信元情報の欠落。
- レスポンスは `{ error: string }`。既存フォームはこのエラーを表示する。
- 現在有効なのはDevのみ。本番・ローカルでは未設定のため従来の動作を維持する。

設定・検証・復旧手順は [Dev環境の防御手順](../manuals/dev-security-hardening.md) を参照。
