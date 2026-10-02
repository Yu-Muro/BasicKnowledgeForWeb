# タイムテーブル `/timetable`

## 概要
- 会期ごとのタイムテーブルを表示・管理するページ。
- `admin` は編集UI、`user` は閲覧UIを利用する。

## アクセス制御
- `GET /api/timetable`
  - `contentAccessMiddleware` 適用
  - `access_token + x-event-id一致` または `auth_token(role=admin)` が必要
- 編集 API（POST/PUT/DELETE）
  - `contentEditMiddleware` + `roleGuard(['admin'])`
  - `auth_token(role=admin)` + `x-event-id` 必須

## 画面構成
- `user`
  - 日付ごとにグルーピング表示
  - 項目: 時刻、タイトル、場所（設定されている場合のみ）、説明
- `admin`
  - `TimetableAdminPanel` で一覧・作成・更新・削除

### 追加・編集の共通操作（admin）
- 「+ 追加」と各項目の「編集」は、同じモーダルでフォームを表示する。
- 編集時は既存の値を入力済みで表示し、入力エラーはモーダル内に表示する。
- 長いフォームはモーダル内でスクロールできる。
- 「キャンセル」「閉じる」、Escape キー、背景クリックで閉じ、操作元のボタンへフォーカスを戻す。
- 保存中は入力・閉じる操作を無効にし、保存成功後にモーダルを閉じて一覧を更新する。

## データ構造
```ts
type TimetableItem = {
  id: string;
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string; // 空文字の場合あり
  description: string | null;
}
```

## API
### `GET /api/timetable`
- ヘッダー: `x-event-id`
- レスポンス: `{ "items": TimetableItem[] }`

### `POST /api/timetable`（admin）
```json
{
  "event_id": "uuid",
  "title": "開会",
  "start_time": "2026-05-01T09:00:00.000Z",
  "description": "任意"
}
```
- `location` は任意（未指定時は空文字で保存）
- レスポンス: `{ "item": TimetableItem }`

### `PUT /api/timetable/:id`（admin）
- ボディは部分更新可（1項目以上必須）
- レスポンス: `{ "item": TimetableItem }`

### `DELETE /api/timetable/:id`（admin）
- レスポンス: `{ "id": "uuid" }`

## 実装メモ
- ページ: `apps/frontend/app/(authenticated)/timetable/page.tsx`
- Action: `apps/frontend/app/actions/timetable.ts`
- バックエンド: `timetableController.ts`, `timetableRoutes.ts`
- 現行実装では `end_time` は入力せず、`start_time` と同値で保存される

## テスト観点
- 会期未選択時の表示
- `user` で閲覧のみ可能
- `admin` で CRUD 成功/失敗時メッセージ
- `x-event-id` 不備時の `400`
- 認証不備時の `401/403`
