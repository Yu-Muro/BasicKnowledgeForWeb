# 部屋割り `/rooms`

## 概要
- 会期ごとの部屋割りを表示・管理するページ。
- 担当部署（前日/当日）と目的、備考を扱う。

## アクセス制御
- 閲覧: `contentAccessMiddleware`
- 編集: `contentEditMiddleware` + `roleGuard(['admin'])`
- 編集 API は `auth_token(role=admin)` と `x-event-id` が必須

## 画面構成
- `user`
  - デスクトップ: テーブル表示（部屋、前日担当、当日担当、備考）
  - モバイル: カード表示
- `admin`
  - `RoomAdminPanel` で一覧・作成・更新・削除
  - 部署候補は `/api/departments` から取得

### 追加・編集の共通操作（admin）
- 「+ 追加」と各項目の「編集」は、同じモーダルでフォームを表示する。
- 編集時は既存の値を入力済みで表示し、入力エラーはモーダル内に表示する。
- 長いフォームはモーダル内でスクロールできる。
- 「キャンセル」「閉じる」、Escape キー、背景クリックで閉じ、操作元のボタンへフォーカスを戻す。
- 保存中は入力・閉じる操作を無効にし、保存成功後にモーダルを閉じて一覧を更新する。

## データ構造
```ts
type RoomWithDepartments = {
  id: string;
  eventId: string;
  buildingName: string;
  floor: string;
  roomName: string;
  preDayManagerId: string | null;
  preDayManagerName: string | null;
  preDayPurpose: string | null;
  dayManagerId: string;
  dayManagerName: string;
  dayPurpose: string;
  notes: string | null;
}
```

## API
### `GET /api/rooms`
- ヘッダー: `x-event-id`
- レスポンス: `{ "rooms": RoomWithDepartments[] }`

### `POST /api/rooms`（admin）
```json
{
  "event_id": "uuid",
  "building_name": "1号館",
  "floor": "2F",
  "room_name": "201",
  "day_manager_id": "uuid",
  "day_purpose": "本部",
  "pre_day_manager_id": "uuid or null",
  "pre_day_purpose": "任意",
  "notes": "任意"
}
```

### `PUT /api/rooms/:id`（admin）
- 部分更新可

### `DELETE /api/rooms/:id`（admin）
- レスポンス: `{ "id": "uuid" }`

## 関連 API
- `GET /api/departments`（部署名表示・選択用）

## 実装メモ
- ページ: `apps/frontend/app/(authenticated)/rooms/page.tsx`
- Action: `apps/frontend/app/actions/rooms.ts`
- バックエンド: `roomController.ts`, `roomRoutes.ts`

## テスト観点
- ソート順（建物 → 階 → 部屋名）
- 会期不一致データの更新拒否
- 部署未設定（前日担当なし）の表示
- 認証/認可失敗時のステータス
