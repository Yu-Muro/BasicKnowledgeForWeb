---
name: departments-page
description: docs/pages/12-departments.md をもとに `/departments` の UI・API・テストを実装する際のタスクリスト。
---

# Departments ページ実装ガイド

参照: `docs/pages/12-departments.md`

## スコープ
- `/departments` の admin 専用 UI（一覧・追加・更新・削除）
- `GET/POST/PUT/DELETE /api/departments` の backend 実装
- 部屋割り・タイムテーブル部署タグの参照時の削除制約（409）と会期スコープ制御

## 手順
1. **データ要件**
   - `Department` は `event_id` 単位で管理する。
   - 一覧は `name` 昇順で返す。
2. **バックエンド**
   - Schema: 既存の `departments` と `(event_id, id)` の複合ユニークを確認する。ユーザーと部署の関連テーブルは、現行モデルに存在せず、別途要件がある場合だけ検討する。
   - Routes: `GET /api/departments` は `contentAccessMiddleware`、`POST/PUT/DELETE` は `contentEditMiddleware` + `roleGuard(['admin'])`。
   - Validator: `event_id` と `x-event-id` の整合、更新フィールド必須、削除時のエラー形を定義。
   - Error handling: 参照中部署の削除失敗は `409` を返す。
3. **フロントエンド UI**
   - Server Component で `resolveAuth(event_id)` を使い、`role !== 'admin'` は `/dashboard` へリダイレクト。
   - 会期未選択時は空状態メッセージを表示。
   - `DepartmentAdminPanel` で追加・編集・削除フォームを提供。
4. **編集導線 (admin)**
   - `app/actions/departments.ts` からAPIを呼び、成功後は既存panelの一覧更新・snapshot取得の流れを維持する。
   - `409` は「部屋割りで利用中のため削除できない」旨を表示。
5. **テスト**
   - Backend Feature: access_token 成功、auth_token(admin) 成功、auth_token(user) 拒否、`x-event-id` 不一致拒否。
   - Frontend: user リダイレクト、会期未選択表示、admin CRUD 導線、409 エラー表示を確認。
6. **完了確認**
   ```bash
   apps/backend: bun run type-check && bun run lint && bun run test
   apps/frontend: bun run type-check && bun run lint && bun run test
   ```

## 成果物
- `Department` CRUD API と validator/repository/use-case/controller
- `/departments` ページ（admin 専用）
- ロール制御・会期制御・削除制約をカバーするテスト
