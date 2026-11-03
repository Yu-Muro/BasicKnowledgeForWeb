---
name: rooms-page
description: docs/pages/06-rooms.md をもとに `/rooms` の UI・API・テストを実装する際のタスクリスト。
---

# Rooms ページ実装ガイド

参照: `docs/pages/06-rooms.md`

## スコープ
- `/rooms` の PC/モバイル UI、admin 編集導線
- `GET /api/rooms` (RoomWithDepartments) と CRUD の backend 実装
- 部署 JOIN、複合 FK、イベントスコープ制御

## 手順
1. **データ要件**
   - `RoomWithDepartments` を返し、`preDayManagerName` / `dayManagerName` を JOIN で解決。
   - 並び順: `building_name` → `floor` → `room_name` 昇順。
2. **バックエンド**
   - Schema: `rooms` テーブル + `(event_id, manager_id)` → `departments(event_id, id)` 複合 FK。
   - Repository: `alias` を使い、pre/day 部署を LEFT / INNER JOIN で取得。
   - Routes: `GET /api/rooms` では `contentAccessMiddleware` + `x-event-id` header 必須、必要なら POST/PUT/DELETE で role guard。
   - Validator: 入力/レスポンス DTO と `x-event-id` header を Zod で定義。
3. **フロントエンド UI**
   - PC: テーブル表示（部屋名/担当/用途）。
   - モバイル: カード表示 (部屋名を見出し、担当・用途を縦積み) で `[⋮]` メニューから編集/削除。
   - フォーム: `react-hook-form` + backendの `createRoomSchema` / `updateRoomSchema` を共有する。
4. **編集導線 (admin)**
   - ロール判定で `[+追加]` ボタンや編集 UI を表示。
   - 追加/更新フォームで部署セレクトを提供（pre/day それぞれ）。
5. **テスト**
   - Backend Feature: access_token 成功、auth_token(admin) 成功、auth_token(user) 拒否、`x-event-id` 不一致拒否。
   - Frontend: PC 表示、モバイルカード、admin 編集 UI、user 非表示を確認。
6. **完了確認**
   ```bash
   apps/backend: bun run type-check && bun run lint && bun run test
   apps/frontend: bun run type-check && bun run lint && bun run test
   ```

## 成果物
- `RoomWithDepartments` DTO と `GET /api/rooms`
- `/rooms` ページ (PC/モバイル/編集UI)
- JOIN / 複合 FK / ロール別 UI をカバーするテスト
