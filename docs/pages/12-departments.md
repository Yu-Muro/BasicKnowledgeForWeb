# 部署管理 `/departments`

## 概要
- 会期ごとの部署マスタを管理するページ。
- 現行フロント実装では `admin` 専用画面で、`user` は `/dashboard` へリダイレクトされる。

## アクセス制御
- 画面アクセス
  - `admin`: 表示
  - `user`: `/dashboard` へリダイレクト
- API アクセス
  - `GET /api/departments`: `contentAccessMiddleware`
  - `POST/PUT/DELETE /api/departments*`: `contentEditMiddleware` + `roleGuard(['admin'])`
- いずれの API も `x-event-id` ヘッダーが必要

## 画面構成
- 見出し
  - タイトル: `部署管理`
  - 説明: `イベントに参加する部署を管理します。`
- 状態表示
  - 会期未選択: `会期が選択されていません`
  - 空状態: `登録されている部署はありません`
  - 成功メッセージ（追加/更新/削除）
  - エラーメッセージ
- 編集機能（admin）
  - 過去会期からコピー（コピー元会期を選択して部署名を一括追加）
  - 追加フォーム（部署名）
  - 一覧行ごとの編集・削除

## データ構造
```ts
type Department = {
  id: string;
  eventId: string;
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
}
```

## API
### `GET /api/departments`
- ヘッダー: `x-event-id`
- レスポンス
```json
{
  "departments": [
    { "id": "uuid", "eventId": "uuid", "name": "企画部" }
  ]
}
```

### `POST /api/departments`（admin）
- リクエスト
```json
{
  "event_id": "uuid",
  "name": "企画部"
}
```
- 備考
  - `event_id` と `x-event-id` が一致しない場合は `400`

### `PUT /api/departments/:id`（admin）
- リクエスト（部分更新）
```json
{
  "name": "新しい部署名"
}
```
- 備考
  - 更新項目が空の場合は `400`

### `POST /api/departments/copy`（admin）
- リクエスト
```json
{
  "source_event_id": "uuid"
}
```
- レスポンス
```json
{
  "departments": [
    { "id": "uuid", "eventId": "uuid", "name": "広報部" }
  ],
  "createdCount": 1,
  "skippedCount": 2
}
```
- 備考
  - `source_event_id === x-event-id` は `400`
  - コピー元会期に部署がない場合は `404`
  - コピー先に同名部署がある場合はスキップされる

### `DELETE /api/departments/:id`（admin）
- レスポンス
```json
{ "id": "uuid" }
```
- 備考
  - 対象なしは `404`
  - 部屋割りに参照されている部署は `409`（外部キー制約）
  - タイムテーブルの部署タグだけに参照されている場合は、タグを自動解除して削除する

## 実装メモ
- ページ: `apps/frontend/app/(authenticated)/departments/page.tsx`
- 管理 UI: `apps/frontend/app/(authenticated)/departments/DepartmentAdminPanel.tsx`
- Action: `apps/frontend/app/actions/departments.ts`
- バックエンド: `apps/backend/src/presentation/controllers/departmentController.ts`, `apps/backend/src/presentation/routes/departmentRoutes.ts`

## テスト観点
- `user` で `/dashboard` にリダイレクトされること
- `x-event-id` 不備時に `400` が返ること
- `event_id` と `x-event-id` の不一致で `400` になること
- 同名部署を重複作成せずコピーできること
- 部署が部屋に紐づく場合の削除 `409` が返ること
- 追加/更新/削除後に一覧が再取得されること
