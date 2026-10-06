# 企画一覧 `/events`

## 概要
- 会期ごとの企画情報を表示・管理するページ。
- `admin` は編集UI、`user` はカード形式で閲覧する。

## アクセス制御
- 閲覧: `contentAccessMiddleware`
- 編集: `contentEditMiddleware` + `roleGuard(['admin', 'user'])`
- 編集 API は `auth_token(role=admin または user)` と `x-event-id` が必須

## 画面構成
- アクセスコード利用者
  - 企画名、場所、日時、説明、画像を表示
  - 開始時刻順で表示
- 管理者・部署スタッフ
  - `ProgramAdminPanel` で一覧・作成・更新・削除
  - 画像アップロード機能あり

### 追加・編集の共通操作（管理者・部署スタッフ）
- 「+ 追加」と各項目の「編集」は、同じモーダルでフォームを表示する。
- 編集時は既存の値を入力済みで表示し、入力エラーはモーダル内に表示する。
- 長いフォームはモーダル内でスクロールできる。
- 「キャンセル」「閉じる」、Escape キー、背景クリックで閉じ、操作元のボタンへフォーカスを戻す。
- 保存中は入力・閉じる操作を無効にし、保存成功後にモーダルを閉じて一覧を更新する。

## データ構造
```ts
type Program = {
  id: string;
  eventId: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  description: string | null;
  imageUrl: string | null;
}
```

## API
### `GET /api/programs`
- ヘッダー: `x-event-id`
- レスポンス: `{ "programs": Program[] }`

### `POST /api/programs`（管理者・部署スタッフ）
```json
{
  "event_id": "uuid",
  "name": "企画名",
  "location": "会場",
  "start_time": "2026-05-01T10:00:00.000Z",
  "end_time": "2026-05-01T11:00:00.000Z",
  "description": "任意",
  "image_key": "programs/<event_id>/<uuid>.webp"
}
```
- `end_time` は `start_time` より後である必要がある

### `PUT /api/programs/:id`（管理者・部署スタッフ）
- 部分更新可

### `DELETE /api/programs/:id`（管理者・部署スタッフ）
- レスポンス: `{ "id": "uuid" }`

### `POST /api/programs/upload`（管理者・部署スタッフ）
- `multipart/form-data` で `file` を送信
- レスポンス: `{ "imageKey": "programs/<event_id>/<uuid>.ext" }`

## 実装メモ
- ページ: `apps/frontend/app/(authenticated)/events/page.tsx`
- Action: `apps/frontend/app/actions/programs.ts`
- バックエンド: `programController.ts`, `programRoutes.ts`

## テスト観点
- `end_time <= start_time` の拒否
- 画像キーのプレフィックス検証（`programs/<event_id>/`）
- 管理者・部署スタッフと閲覧者の表示分岐
- 会期未選択時の表示

部署スタッフは所属部署にかかわらず全コンテンツを閲覧・編集できる。部署管理・アクセスコード管理・他ユーザー管理は管理者のみ。
