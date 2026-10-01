---
name: frontend-authenticated-layout
description: "`(authenticated)`レイアウト、共通ナビゲーション、会期選択、レスポンシブ表示を実装・改修するときに使う。"
---

# `(authenticated)` レイアウト実装ガイド

## ゴール
- `(authenticated)` route group 配下の `/`, `/timetable`, `/rooms`, `/events`, `/shop`, `/others`, `/search` が共通 layout を共有
- 共通ヘッダーにイベント名・ナビゲーション・ログアウト導線・会期セレクター（adminのみ）を実装
- モバイルではハンバーガー/ドロワー UI に切り替え

## 手順
1. **Route Group 作成**
   - `apps/frontend/app/(authenticated)/layout.tsx` を追加し、child routes をここに移動。
   - 既存の `/` ルートと重複しないよう注意（旧デモページを削除 or rename）。
2. **Layout 実装**
   - Server Component で `GET /api/access-codes` を呼び、ユーザーの role と会期一覧を取得。
   - 会期名表示、nav リンク（home/timetable/rooms/events/shop/others/search）、ログアウトボタンを共通化。
   - `admin` のみ会期セレクター（`EventSelector`）を表示し、選択値は query string で保持。
3. **ヘッダー/ナビのレスポンシブ対応**
   - `lg:` 以上は水平メニュー、`md` 未満はハンバーガー + ドロワーに切り替える。
   - ドロワー内に nav/会期セレクター/ログアウト導線を格納。
4. **会期 ID の伝播**
   - admin は query string の `eventId` を保持し、`resolveAuth` + `buildContentFetchHeaders` で `x-event-id` に渡す。
   - user は `access_token` payload の `event_id` を使う（query string に依存しない）。
5. **テスト** (`apps/frontend/tests/`)
   - layout または layout を通した page test で以下を確認:
     - 認証済みユーザーで nav が表示される。
     - admin のみ会期セレクターが表示される。
     - user ロールではセレクターが出ない。
     - モバイル viewport でハンバーガーが表示され、メニューが開閉する。
6. **完了条件**
   ```bash
   cd apps/frontend
   bun run type-check
   bun run lint
   bun run test
   ```

## 成果物チェックリスト
- `(authenticated)/layout.tsx` + 共通ヘッダー/ナビ/会期セレクター
- 会期選択状態の保持と `x-event-id` header 付与
- 7ページ（`/search` 含む）が route group 配下に移動済み
- レスポンシブ UI / ロール別表示のテスト
