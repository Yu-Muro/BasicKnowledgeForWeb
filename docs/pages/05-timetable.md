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
  - 日付ごとにグルーピングしたレーン型表示
  - 表示列はユーザーが選択する
    - `全体向け`
    - 会期に登録されている各部署
  - `全体向け` は常時表示ではなく、選択時のみ表示する
  - 項目: 時間帯、タイトル、場所（設定されている場合のみ）、説明、表示タグ
  - 日をまたぐ項目は終了側に日付も表示する
- `admin`
  - `TimetableAdminPanel` で一覧・作成・更新・削除
  - 作成・更新フォームで `全体向けに表示` と複数の部署タグを指定できる

## データ構造
```ts
type TimetableDepartment = {
  id: string;
  name: string;
}

type TimetableItem = {
  id: string;
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string; // 空文字の場合あり
  description: string | null;
  isPublic: boolean;
  departments: TimetableDepartment[];
}
```

`isPublic === true` の項目は `全体向け` 列に表示される。  
`departments` に部署が含まれる項目は、該当部署の列に表示される。  
1つの項目は `全体向け` と複数部署タグを同時に持てる。

DB では `timetable_items.is_public` と、
`timetable_item_departments` 中間テーブルで表現する。
部署を削除した場合、その部署のタイムテーブルタグは自動解除される。

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
  "end_time": "2026-05-01T10:00:00.000Z",
  "is_public": true,
  "department_ids": ["uuid"],
  "description": "任意"
}
```
- `location` は任意（未指定時は空文字で保存）
- `end_time` は任意。未指定時は `start_time` と同値で保存される
- `is_public` は任意。未指定時は `true`
- `department_ids` は任意。複数部署を指定できる
- レスポンス: `{ "item": TimetableItem }`

### `PUT /api/timetable/:id`（admin）
- ボディは部分更新可（1項目以上必須）
- `department_ids: []` で部署タグを全解除できる
- レスポンス: `{ "item": TimetableItem }`

### `DELETE /api/timetable/:id`（admin）
- レスポンス: `{ "id": "uuid" }`

## 実装メモ
- ページ: `apps/frontend/app/(authenticated)/timetable/page.tsx`
- Action: `apps/frontend/app/actions/timetable.ts`
- バックエンド: `timetableController.ts`, `timetableRoutes.ts`
- レーン表示: `TimetableLaneView`

## テスト観点
- 会期未選択時の表示
- `user` で閲覧のみ可能
- `admin` で CRUD 成功/失敗時メッセージ
- 表示列の選択で `全体向け` と部署列を切り替えられること
- 全体向けと部署タグの両方を持つ項目が該当列に表示されること
- 部署一覧の取得失敗時も項目に含まれる部署レーンを表示できること
- 日をまたぐ項目の終了日時を判別できること
- `x-event-id` 不備時の `400`
- 認証不備時の `401/403`
