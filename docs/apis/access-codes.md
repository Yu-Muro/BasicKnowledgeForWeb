# Access Codes API 仕様

このドキュメントは `/api/access-codes*` を対象にします。

## 共通

- 認証方式:
  - `access_token`（`POST /api/access-codes/verify` で発行）
  - `auth_token`（`POST /api/auth/login` で発行）
- 閲覧系（`GET /api/access-codes/:id`）は `contentAccessMiddleware` を使用
  - `access_token` の `event_id` と `x-event-id` が一致、または
  - `auth_token` の `role=admin`

## POST `/api/access-codes/verify`

- 認証: 不要
- Body:
```json
{
  "code": "ABC123"
}
```
- 成功:
  - `200`
  - `access_token` Cookie をセット
  - Body: `{ "message": "アクセスコードを確認しました" }`
- 主なエラー:
  - `400` バリデーションエラー
  - `401` コード不正 / 期限切れ

## GET `/api/access-codes/:id`

- 認証: `contentAccessMiddleware`
- 会期トークン利用時の必須ヘッダー:
  - `x-event-id: <uuid>`（トークンの `event_id` およびURLの `id` と一致必須）
  - DB上で管理者と確認できたユーザー認証では、会期ヘッダーなしでも取得できる。
- Path Param:
  - `id`: access code の UUID
- 成功:
  - `200`
  - Body:
```json
{
  "code": {
    "id": "uuid",
    "code": "ABC123",
    "eventName": "例大祭 2026",
    "validFrom": "2026-05-01T00:00:00.000Z",
    "validTo": "2026-05-31T00:00:00.000Z",
    "createdBy": "uuid",
    "createdAt": "2026-04-01T00:00:00.000Z"
  }
}
```
- 主なエラー:
  - `401` Unauthorized
  - `403` 会期トークンで別会期のIDを取得しようとした場合
  - `404` not found

## GET `/api/access-codes`

- 認証: `auth_token` 必須
- 権限: `admin` のみ
- 成功:
  - `200`
  - Body: `{ "codes": [ ... ] }`
- 主なエラー:
  - `401` Unauthorized
  - `403` Forbidden
  - `500` サーバーエラー

## POST `/api/access-codes`

- 認証: `auth_token` 必須
- 権限: `admin` のみ
- Body:
```json
{
  "code": "ABC123",
  "eventName": "例大祭 2026",
  "validFrom": "2026-05-01T00:00:00.000Z",
  "validTo": "2026-05-31T00:00:00.000Z"
}
```
- 備考:
  - `validTo` は `validFrom` より後である必要があります
- 成功:
  - `201`
  - Body: `{ "code": { ... } }`
- 主なエラー:
  - `400` バリデーションエラー / 重複など
  - `401` Unauthorized
  - `403` Forbidden

## DELETE `/api/access-codes/:id`

- 認証: `auth_token` 必須
- 権限: `admin` のみ
- Path Param:
  - `id`: UUID
- 成功:
  - `200`
  - Body: `{ "message": "削除しました" }`
- 主なエラー:
  - `401` Unauthorized
  - `403` Forbidden
  - `404` not found
  - `500` サーバーエラー

## 実装参照

- Route: `apps/backend/src/presentation/routes/accessCodeRoutes.ts`
- Controller: `apps/backend/src/presentation/controllers/accessCodeController.ts`
- Validator: `apps/backend/src/infrastructure/validators/accessCodeValidator.ts`
