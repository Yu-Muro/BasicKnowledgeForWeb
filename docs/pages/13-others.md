# その他の情報 `/others`

## 概要
- 会期ごとの自由記述情報（注意事項・連絡事項など）を表示・管理するページ。
- 管理者（`admin`）と部署スタッフ（`user`）は編集UI、アクセスコード利用者は閲覧UIを利用する。

## アクセス制御
- 閲覧: `contentAccessMiddleware`
- 編集: `contentEditMiddleware` + `roleGuard(['admin', 'user'])`
- 編集 API は `auth_token(role=admin または user)` と `x-event-id` が必須

## 画面構成
- アクセスコード利用者
  - `displayOrder` 昇順で一覧表示
  - タイトル、本文、画像を表示
- 管理者・部署スタッフ
  - `OtherItemAdminPanel` で一覧・作成・更新・削除
  - 画像アップロード機能あり

### 追加・編集の共通操作（管理者・部署スタッフ）
- 「+ 追加」と各項目の「編集」は、同じモーダルでフォームを表示する。
- 編集時は既存の値を入力済みで表示し、入力エラーはモーダル内に表示する。
- 長いフォームはモーダル内でスクロールできる。
- 「キャンセル」「閉じる」、Escape キー、背景クリックで閉じ、操作元のボタンへフォーカスを戻す。
- 保存中は入力・閉じる操作を無効にし、保存成功後にモーダルを閉じて一覧を更新する。

## データ構造
```ts
type OtherItem = {
  id: string;
  eventId: string;
  title: string;
  content: string;
  imageUrl: string | null;
  displayOrder: number;
  createdBy: string;
}
```

## API
### `GET /api/others`
- ヘッダー: `x-event-id`
- レスポンス: `{ "items": OtherItem[] }`

### `POST /api/others`（管理者・部署スタッフ）
```json
{
  "event_id": "uuid",
  "title": "お知らせ",
  "content": "本文",
  "display_order": 1,
  "image_key": "others/<event_id>/<uuid>.webp"
}
```
- `createdBy` はサーバー側で `auth_token` から補完

### `PUT /api/others/:id`（管理者・部署スタッフ）
- 部分更新可

### `DELETE /api/others/:id`（管理者・部署スタッフ）
- レスポンス: `{ "id": "uuid" }`

### `POST /api/others/upload`（管理者・部署スタッフ）
- `multipart/form-data` で `file` を送信
- レスポンス: `{ "imageKey": "others/<event_id>/<uuid>.ext" }`

## 実装メモ
- ページ: `apps/frontend/app/(authenticated)/others/page.tsx`
- Action: `apps/frontend/app/actions/others.ts`
- バックエンド: `otherItemController.ts`, `otherItemRoutes.ts`

## テスト観点
- `display_order` の昇順表示
- 画像キーのプレフィックス検証（`others/<event_id>/`）
- 管理者・部署スタッフと閲覧者の表示分岐
- 会期未選択時の表示

部署スタッフは所属部署にかかわらず全コンテンツを閲覧・編集できる。部署管理・アクセスコード管理・他ユーザー管理は管理者のみ。
