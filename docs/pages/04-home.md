# TOP ページ `/`

## 概要
- 認証後のホーム画面。
- 会期名を表示し、各機能ページへのナビゲーションカードを提供する。

## アクセス制御
- 管理者・部署スタッフ
  - `auth_token` でログイン
  - ヘッダーの会期セレクターで `?event_id=` を切り替え
- アクセスコード利用者
  - `access_token` の `event_id` が会期として使われる

## 画面構成
- 見出し
  - 会期名が取得できる場合: `ようこそ、{eventName}へ`
  - 取得できない場合: `ようこそ`
- ナビゲーションカード
  - `/timetable`
  - `/rooms`
  - `/events`
  - `/shop`
  - `/others`
  - `/search`

## データ取得
### `GET /api/access-codes/:id`
- 会期名表示用に使用
- ヘッダー
  - `x-event-id: <eventId>`
  - 管理者・部署スタッフ: `auth_token` Cookie
  - アクセスコード利用者: `access_token` Cookie

## 実装メモ
- ページ: `apps/frontend/app/(authenticated)/page.tsx`
- 認証解決: `resolveAuth(event_id)`
- ヘッダー組み立て: `buildContentFetchHeaders(...)`
- 共通ヘッダー/会期選択: `apps/frontend/app/(authenticated)/layout.tsx`, `apps/frontend/components/AuthHeader.tsx`

## テスト観点
- 管理者・部署スタッフ で `event_id` なしの場合、会期未選択状態が表示される
- アクセスコード利用者 で `access_token` の会期名が表示される
- 各カード遷移時に `event_id` クエリが保持される（admin）

ログイン済みの会期セレクターは `GET /api/events` を使用し、会期ID・会期名のみを取得する。
