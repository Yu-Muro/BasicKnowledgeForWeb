# Phase 4-6 Frontend: `/departments`

> 区分: 部署画面の初期実装計画の記録。現行画面は実装済みで、この資料は現在の実装手順ではありません。
> 現行仕様は [部署ページ仕様](../pages/12-departments.md)、実装は `apps/frontend/app/(authenticated)/departments/` を確認してください。

## 対象

- `docs/pages/12-departments.md`

## 目的

admin が会期ごとの部署を管理できる画面を実装する。  
`user` はこのページにアクセスできないようにする。

## 実装内容

1. Server Component として `/departments` を実装する
2. `resolveAuth(event_id)` で認証情報を解決し、`role !== 'admin'` は `/dashboard` にリダイレクトする
3. 会期未選択時は「会期が選択されていません」を表示する
4. `GET /api/departments` を `x-event-id` 付きで取得し、初期一覧を表示する
5. `DepartmentAdminPanel`（Client Component）で追加 / 更新 / 削除を実装する
6. Server Actions（`app/actions/departments.ts`）経由で `POST/PUT/DELETE /api/departments` を呼び出し、成功時は `revalidatePath('/departments')`
7. 削除時に `409`（部屋割りで参照中）を受けた場合は、ユーザーが理解できるエラーメッセージを表示する

## テスト

- `user` でアクセスしたとき `/dashboard` にリダイレクトされる
- admin で `event_id` 未指定時に未選択メッセージが表示される
- 一覧が表示される
- 追加 / 更新 / 削除操作が action を通じて呼び出される
- `409` エラー時に適切なメッセージが表示される

## 完了条件

- `/departments` で admin が CRUD を実行できる
- user は画面へアクセスできない
- page test または主要コンポーネントテストが追加されている
- `apps/frontend` の `type-check`, `test`, `lint` が通る
