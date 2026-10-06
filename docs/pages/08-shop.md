# 販売物一覧 `/shop`

## 概要
- 会期ごとの販売物を表示・管理するページ。
- 管理者・部署スタッフは編集UI、アクセスコード利用者は閲覧UIを利用する。

## アクセス制御
- 閲覧: `contentAccessMiddleware`
- 編集: `contentEditMiddleware` + `roleGuard(['admin', 'user'])`
- 編集 API は `auth_token(role=admin または user)` と `x-event-id` が必須

## 画面構成
- アクセスコード利用者
  - 商品名、価格、説明、画像を表示
  - 商品名順で表示
  - `imageUrl` が空のデータを警告表示
- 管理者・部署スタッフ
  - `ShopItemAdminPanel` で一覧・作成・更新・削除
  - 画像アップロード機能あり

### 追加・編集の共通操作（管理者・部署スタッフ）
- 「+ 追加」と各項目の「編集」は、同じモーダルでフォームを表示する。
- 編集時は既存の値を入力済みで表示し、入力エラーはモーダル内に表示する。
- 長いフォームはモーダル内でスクロールできる。
- 「キャンセル」「閉じる」、Escape キー、背景クリックで閉じ、操作元のボタンへフォーカスを戻す。
- 保存中は入力・閉じる操作を無効にし、保存成功後にモーダルを閉じて一覧を更新する。

## データ構造
```ts
type ShopItem = {
  id: string;
  eventId: string;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string;
}
```

## API
### `GET /api/shop-items`
- ヘッダー: `x-event-id`
- レスポンス: `{ "items": ShopItem[] }`

### `POST /api/shop-items`（管理者・部署スタッフ）
```json
{
  "event_id": "uuid",
  "name": "新刊セット",
  "price": 2000,
  "description": "任意",
  "image_key": "shop-items/<event_id>/<uuid>.webp"
}
```
- `image_key` は必須

### `PUT /api/shop-items/:id`（管理者・部署スタッフ）
- 部分更新可

### `DELETE /api/shop-items/:id`（管理者・部署スタッフ）
- レスポンス: `{ "id": "uuid" }`

### `POST /api/shop-items/upload`（管理者・部署スタッフ）
- `multipart/form-data` で `file` を送信
- レスポンス: `{ "imageKey": "shop-items/<event_id>/<uuid>.ext" }`

## 実装メモ
- ページ: `apps/frontend/app/(authenticated)/shop/page.tsx`
- Action: `apps/frontend/app/actions/shop-items.ts`
- バックエンド: `shopItemController.ts`, `shopItemRoutes.ts`
- 旧 `stock_status` / `upload-url` 仕様は廃止済み

## テスト観点
- 価格の最小値（0以上）
- 画像キーのプレフィックス検証（`shop-items/<event_id>/`）
- 管理者・部署スタッフと閲覧者の表示分岐
- 画像未設定データの表示挙動

部署スタッフは所属部署にかかわらず全コンテンツを閲覧・編集できる。部署管理・アクセスコード管理・他ユーザー管理は管理者のみ。
