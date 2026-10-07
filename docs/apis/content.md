# Content API 仕様

このドキュメントは以下を対象にします。

- `/api/timetable`
- `/api/rooms`
- `/api/programs`
- `/api/shop-items`
- `/api/departments`
- `/api/others`

## 共通仕様

部署APIは会期指定とコンテンツ認証の例外です。詳細は Departments 節を参照してください。

### 認証・権限

- 閲覧（GET）:
  - `contentAccessMiddleware`
  - 必須: `x-event-id: <uuid>`
  - 許可条件:
    - `access_token.event_id === x-event-id`
    - または `auth_token.role === admin`
- 編集（POST/PUT/DELETE）:
  - `contentEditMiddleware` + `roleGuard(['admin'])`
  - 必須:
    - `auth_token`（admin）
    - `x-event-id: <uuid>`

### 共通エラー

- `400`: バリデーションエラー / `event_id` 不一致
- `401`: Unauthorized
- `403`: Forbidden（非admin）
- `404`: 対象データなし
- `500`: サーバーエラー

### 更新系の `event_id` ルール

- `POST` の body に含める `event_id` は `x-event-id` と一致必須
- 不一致時は `400` / `{ "error": "event_id が一致しません" }`

## Timetable

### GET `/api/timetable`

- 成功: `200`
- Body: `{ "items": TimetableItem[] }`
- `TimetableItem` 主な項目:
  - `id`, `eventId`, `title`, `startTime`, `endTime`, `location`, `description`

### POST `/api/timetable`

- Body:
```json
{
  "event_id": "uuid",
  "title": "設営",
  "start_time": "2026-05-03T09:00:00.000Z",
  "location": "Aホール",
  "description": "集合"
}
```
- 成功: `201` / `{ "item": { ... } }`

### PUT `/api/timetable/:id`

- Body（部分更新可、1項目以上必須）:
```json
{
  "title": "設営（更新）"
}
```
- 成功: `200` / `{ "item": { ... } }`

### DELETE `/api/timetable/:id`

- 成功: `200` / `{ "id": "uuid" }`

## Rooms

### GET `/api/rooms`

- 成功: `200`
- Body: `{ "rooms": RoomWithDepartments[] }`
- `RoomWithDepartments` 主な項目:
  - `id`, `eventId`, `buildingName`, `floor`, `roomName`
  - `preDayManagerId`, `preDayManagerName`, `preDayPurpose`
  - `dayManagerId`, `dayManagerName`, `dayPurpose`, `notes`

### POST `/api/rooms`

- Body:
```json
{
  "event_id": "uuid",
  "building_name": "1号館",
  "floor": "2F",
  "room_name": "201",
  "pre_day_manager_id": null,
  "pre_day_purpose": null,
  "day_manager_id": "uuid",
  "day_purpose": "待機室",
  "notes": null
}
```
- 成功: `201` / `{ "room": { ... } }`

### PUT `/api/rooms/:id`

- Body（部分更新可、1項目以上必須）
- 成功: `200` / `{ "room": { ... } }`

### DELETE `/api/rooms/:id`

- 成功: `200` / `{ "id": "uuid" }`

## Programs

### GET `/api/programs`

- 成功: `200`
- Body: `{ "programs": Program[] }`

### POST `/api/programs`

- Body:
```json
{
  "event_id": "uuid",
  "name": "ステージ企画",
  "location": "中央ステージ",
  "start_time": "2026-05-03T11:00:00.000Z",
  "end_time": "2026-05-03T12:00:00.000Z",
  "description": "説明",
  "image_key": "programs/uuid/file.webp"
}
```
- 成功: `201` / `{ "program": { ... } }`

### PUT `/api/programs/:id`

- Body（部分更新可、1項目以上必須）
- 成功: `200` / `{ "program": { ... } }`

### DELETE `/api/programs/:id`

- 成功: `200` / `{ "id": "uuid" }`

### POST `/api/programs/upload`

- Content-Type: `multipart/form-data`
- フィールド:
  - `file`（必須）
- 成功: `200`
```json
{
  "imageKey": "programs/<eventId>/<uuid>.webp"
}
```

## Shop Items

### GET `/api/shop-items`

- 成功: `200`
- Body: `{ "items": ShopItem[] }`

### POST `/api/shop-items`

- Body:
```json
{
  "event_id": "uuid",
  "name": "グッズ",
  "price": 1000,
  "description": "説明",
  "image_key": "shop-items/uuid/file.webp"
}
```
- 成功: `201` / `{ "item": { ... } }`

### PUT `/api/shop-items/:id`

- Body（部分更新可、1項目以上必須）
- 成功: `200` / `{ "item": { ... } }`

### DELETE `/api/shop-items/:id`

- 成功: `200` / `{ "id": "uuid" }`

### POST `/api/shop-items/upload`

- Content-Type: `multipart/form-data`
- フィールド:
  - `file`（必須）
- 成功: `200`
```json
{
  "imageKey": "shop-items/<eventId>/<uuid>.webp"
}
```

## Departments

部署は全会期で共通。`x-event-id` は不要。

### GET `/api/departments`
- 認証不要（新規登録の部署候補にも使用）。
- 成功: `200` / `{ "departments": Department[] }`。部署に `eventId` は含まれない。

### POST `/api/departments`
- `auth_token(admin)` 必須。
- Body: `{ "name": "設営部" }`。
- 成功: `201` / `{ "department": { ... } }`。

### PUT `/api/departments/:id`
- `auth_token(admin)` 必須。
- Body: `{ "name": "新名称" }`、空の更新は不可。
- 成功: `200` / `{ "department": { ... } }`。

### DELETE `/api/departments/:id`
- `auth_token(admin)` 必須。
- 成功: `200` / `{ "id": "uuid" }`。
- ユーザー・部屋割り・タイムテーブルが参照中の場合は `409`。
- 会期コピーAPIは廃止。

## Others

### GET `/api/others`

- 成功: `200`
- Body: `{ "items": OtherItem[] }`

### POST `/api/others`

- Body:
```json
{
  "event_id": "uuid",
  "title": "お知らせ",
  "content": "本文",
  "display_order": 0,
  "image_key": "others/uuid/file.webp"
}
```
- 成功: `201` / `{ "item": { ... } }`

### PUT `/api/others/:id`

- Body（部分更新可、1項目以上必須）
- 成功: `200` / `{ "item": { ... } }`

### DELETE `/api/others/:id`

- 成功: `200` / `{ "id": "uuid" }`

### POST `/api/others/upload`

- Content-Type: `multipart/form-data`
- フィールド:
  - `file`（必須）
- 成功: `200`
```json
{
  "imageKey": "others/<eventId>/<uuid>.webp"
}
```

## 実装参照

- Route:
  - `apps/backend/src/presentation/routes/timetableRoutes.ts`
  - `apps/backend/src/presentation/routes/roomRoutes.ts`
  - `apps/backend/src/presentation/routes/programRoutes.ts`
  - `apps/backend/src/presentation/routes/shopItemRoutes.ts`
  - `apps/backend/src/presentation/routes/departmentRoutes.ts`
  - `apps/backend/src/presentation/routes/otherItemRoutes.ts`
- Controller:
  - `apps/backend/src/presentation/controllers/*Controller.ts`（各ドメイン）
- Validator:
  - `apps/backend/src/infrastructure/validators/*Validator.ts`（各ドメイン）

## 部署統合中の変更制限
部署・部屋・タイムテーブルを変更するAPIは、部署統合の完了まで `503` と `Retry-After: 30` を返す。GET・HEADによる閲覧は継続できる。部署の作成・改名で同名部署がある場合は、競合として `409` を返す。
