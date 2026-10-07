# Auth / Users API 仕様

このドキュメントは以下を対象にします。

- `/api/auth/*`
- `/api/users*`

## 共通

- 認証Cookie:
  - `auth_token`（ログインで発行）
- 認証失敗:
  - `401 Unauthorized`（`{ "error": "Unauthorized" }`）
- 権限不足:
  - `403 Forbidden`（`{ "error": "Forbidden" }`）

## Auth

### POST `/api/auth/login`

- 認証: 不要
- Body:
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```
- 成功:
  - `200`
  - `auth_token` Cookie をセット
  - Body: `{ "message": "ログインしました" }`
- 主なエラー:
  - `400` バリデーションエラー
  - `401` 認証失敗

### POST `/api/auth/logout`

- 認証: 不要
- 成功:
  - `200`
  - `auth_token` Cookie を削除
  - Body: `{ "message": "ログアウトしました" }`

### GET `/api/auth/me`

- 認証: `auth_token` 必須
- 成功:
  - `200`
```json
{
  "id": "uuid",
  "name": "管理者",
  "email": "admin@example.com",
  "role": "admin",
  "departmentId": null
}
```
- 主なエラー:
  - `401` Unauthorized

### PUT `/api/auth/password`

- 認証: `auth_token` 必須
- Body:
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password-123"
}
```
- 成功:
  - `200`
  - Body: `{ "message": "パスワードを変更しました" }`
- 主なエラー:
  - `400` バリデーションエラー / 現在パスワード不一致
  - `404` ユーザー未存在
  - `401` Unauthorized

## Users

### POST `/api/users`

- 認証: 不要
- Body:
```json
{
  "name": "一般ユーザー",
  "email": "user@example.com",
  "password": "password123",
  "role": "user",
  "departmentId": "uuid"
}
```
- 備考:
  - `role` 省略時は `user`。`admin` 等の指定は拒否する。
  - `departmentId` は存在する全会期共通の部署のUUID、必須。
  - パスワード・パスワードハッシュを成功レスポンスに含めない。
- 成功:
  - `201`
  - Body: `{ "user": { ... } }`
- 主なエラー:
  - `400` バリデーションエラー / メール重複など
  - `500` サーバーエラー

### GET `/api/users`

- 認証: `auth_token` 必須
- 権限: `admin` のみ
- 成功:
  - `200`
  - Body: `{ "users": [ ... ] }`。所属部署IDを含み、削除済みユーザーは含まない。
- 主なエラー:
  - `401` Unauthorized
  - `403` Forbidden
  - `500` サーバーエラー

### PUT `/api/users/:id/role`

- 認証: `auth_token` 必須
- 権限: `admin` のみ
- Path Param:
  - `id`: UUID
- Body:
```json
{
  "role": "admin"
}
```
- 備考:
  - `role` は `user` または `admin`
  - `user` に変更する場合は `departmentId` が必須。`user` から `admin` への昇格は部署を指定しなければ所属を解除する。管理者のロール再保存では現在の所属を維持し、所属を指定した場合はその部署の存在を検証して更新する。
- 成功:
  - `200`
  - Body: `{ "message": "ロールを変更しました" }`
- 主なエラー:
  - `400` バリデーションエラー
  - `401` Unauthorized
  - `403` Forbidden
  - `404` ユーザー未存在
  - `500` サーバーエラー

### PUT `/api/users/:id/department`

- 認証・権限: `auth_token(admin)`。
- Body: `{ "departmentId": "uuid" }`。
- 成功: `200` / `{ "message": "所属部署を変更しました" }`。
- 不正・存在しない部署は `400`、対象ユーザーなしは `404`。
- 一般ユーザーが自分で部署を変更することはできない。

### DELETE `/api/users/:id`

- 認証・権限: `auth_token(admin)`。
- 成功: `200` / `{ "message": "ユーザーを削除しました" }`。
- `deleted_at` に削除日時を設定し、所属部署も解除する論理削除。既存のメールアドレスは再利用しない。
- 自分自身の削除は `400`、存在しない・削除済みユーザーは `404`。
- 削除後はログインできず、発行済み `auth_token` によるAPIアクセスも `401`。

## セッションと移行期間

- ログイン済みAPIではDB上の現在のロール・所属・削除状態を確認する。古い管理者トークンがあっても降格後は管理操作を拒否する。
- DB確認に失敗した場合は `503` として管理操作を通さない。フロントも401と区別して再試行を案内し、ログイン画面へ転送しない。403は所属などの利用条件を確認する案内を表示する。
- 既存一般ユーザーは管理者による所属指定を待つ。所属未設定ではログインできず、既存セッションも `403`。
- `access_token` は従来通り会期単位の閲覧用トークンであり、ユーザー認証とは別の仕組み。有効な会期トークンと一致する `x-event-id` があれば、期限切れ・削除済みユーザーの `auth_token` が残っていてもコンテンツGETを許可する。管理操作の認証には使えない。

## 実装参照

- Route:
  - `apps/backend/src/presentation/routes/authRoutes.ts`
  - `apps/backend/src/presentation/routes/userRoutes.ts`
- Controller:
  - `apps/backend/src/presentation/controllers/authController.ts`
  - `apps/backend/src/presentation/controllers/userController.ts`
- Validator:
  - `apps/backend/src/infrastructure/validators/authValidator.ts`
  - `apps/backend/src/infrastructure/validators/userValidator.ts`
  - `apps/backend/src/infrastructure/validators/userRoleValidator.ts`

部署統合が未完了の間、ユーザー登録・削除・ロール変更・所属変更は `503` と `Retry-After: 30` を返す。統合後に再試行できる。ユーザー一覧の取得とログインは継続できる。

## GET /api/users/deleted
- 管理者専用。成功は `200` / `{ "users": [...] }`。削除済みユーザーのみを返し、パスワード・セッション世代は返さない。

## POST /api/users/:id/restore
- 管理者専用。Body: `{ "departmentId"?: "uuid" }`。一般ユーザーは有効な部署必須、管理者は任意。
- 成功は `200` / `{ "user": {...}, "message": "ユーザーを復元しました。再ログインしてください" }`。
- 同じID・メールアドレス・名前・パスワード・ロールを保持し、指定した部署に所属する。削除日時を解除し、`session_version` を原子的に加算する。
- `400`: ID・部署不正または一般ユーザーの部署未指定。`404`: 対象なし。`409`: 対象が削除されていない、または並行操作で復元・再削除されてセッション世代が変わった場合。`500`: DBエラー。
- 未認証は `401`、一般ユーザーは `403`、部署統合中は `503`。
- 削除済みメールアドレスの新規登録は禁止する。復元後も削除前の `auth_token` は `401`。本人は従来のパスワードで再ログインする。
- ログイン時はDBの `session_version` をJWTに含める。世代を持たない既存トークンは世代0として扱い、未復元ユーザーのセッションは維持する。
