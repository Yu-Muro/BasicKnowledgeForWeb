# ユーザーダッシュボード `/dashboard`

## 概要
- ログイン済み管理者・部署スタッフのプロフィール表示と自身のパスワード設定画面。
- `admin` のみユーザーの部署・権限・削除管理と管理メニューを利用できる。

## アクセス制御
- `auth_token` がない場合は `/login` にリダイレクト。
- `role=admin` のときのみ以下を表示:
  - ユーザー権限変更パネル
  - 管理メニュー（アクセスコード管理、部署管理）

## 画面構成
- プロフィール
  - 名前
  - メール
  - ロール
- パスワード変更フォーム
- （adminのみ）ユーザー管理
- （adminのみ）管理メニューリンク

## 利用 API
### `GET /api/auth/me`
- 認証ユーザー情報取得

### `PUT /api/auth/password`
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```
- `newPassword` は 8〜128文字
- 成功時は全端末のセッションと現在のCookieが失効する。「再ログインしてください」とログイン画面へのリンクを表示し、再送信を無効化する。

### `GET /api/users`（admin）
- 削除済みを除くユーザー一覧を取得。`departmentId` を含む。

### `PUT /api/users/:id/role`（admin）
```json
{
  "role": "admin"
}
```
- `role` は `user | admin`。`user` へ変更するときは存在する `departmentId` が必須。`admin` への変更では所属を解除する。
- 自分を一般ユーザーへ変更した場合は現在のDBセッションを失効させ、ログインCookieを削除してログイン画面へ移動する。

### `PUT /api/users/:id/department`（admin）
- Body: `{ "departmentId": "uuid" }`。所属未設定ユーザーへの指定と部署変更に使用する。

### `DELETE /api/users/:id`（admin）
- 確認ダイアログで承認後に論理削除する。自分自身は削除できない。
- 所属未設定ユーザーは一覧に「所属未設定」と表示する。管理者が指定するまでログインできない。

## 実装メモ
- ページ: `apps/frontend/app/(authenticated)/dashboard/page.tsx`
- 関連コンポーネント
  - `PasswordChangeForm.tsx`
  - `UserRolePanel.tsx`
- Action: `apps/frontend/app/actions/dashboard.ts`

## テスト観点
- 未ログイン時リダイレクト
- パスワード変更の成功/失敗
- admin でのみユーザー管理が表示される
- ロール・部署変更と削除後の一覧更新
- 自分自身の削除を防ぐ
- 部署未指定の一般ユーザーへの変更を防ぐ
