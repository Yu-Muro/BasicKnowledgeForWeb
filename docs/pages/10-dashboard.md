# ユーザーダッシュボード `/dashboard`

## 概要
- ログインユーザーのプロフィール表示と各種設定画面。
- `admin` のみユーザーの部署・権限・削除・復元管理と管理メニューを利用できる。

## アクセス制御
- `auth_token` がない場合や `/me` が401の場合は `/login` にリダイレクト。
- `/me` が503や接続失敗の場合はログイン画面へ転送せず再試行を案内する。403では所属などの利用条件を確認する案内を表示する。
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
- `newPassword` は 8文字以上

### `GET /api/users`（admin）
- 削除済みを除くユーザー一覧を取得。`departmentId` を含む。

### `PUT /api/users/:id/role`（admin）
```json
{
  "role": "admin"
}
```
- `role` は `user | admin`。`user` へ変更するときは存在する `departmentId` が必須。一般ユーザーから`admin`への変更では所属を解除する。管理者のロールを再保存する場合は所属を維持する。
- 自分を一般ユーザーへ変更した場合はログインCookieを削除してログイン画面へ移動する。

### `PUT /api/users/:id/department`（admin）
- Body: `{ "departmentId": "uuid" }`。所属未設定ユーザーへの指定と部署変更に使用する。

### `DELETE /api/users/:id`（admin）
- 確認ダイアログで承認後に論理削除する。自分自身は削除できない。
- 所属未設定ユーザーは一覧に「所属未設定」と表示する。管理者が指定するまでログインできない。

### `GET /api/users/deleted`（admin）
- 削除済みユーザーのみ取得し、「削除済みユーザー」欄へ表示する。取得失敗は空一覧と区別して再取得ボタンを表示。

### `POST /api/users/:id/restore`（admin）
- Body: `{ "departmentId": "uuid" }`。一般ユーザーは部署必須、管理者は任意。
- 部署を選択して「復元」を押し確認ダイアログで確定する。ロール・ID・メール・パスワードは保持する。
- 削除前のログイン状態は復活せず、本人の再ログインが必要。
- 削除済みメールアドレスによる新規登録は許可しない。

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
- 削除済みユーザー一覧、復元時の部署必須、管理者の所属任意、復元成功/失敗と再ログイン案内
- 自分自身の削除を防ぐ
- 部署未指定の一般ユーザーへの変更を防ぐ
