# API仕様書（一覧）

このドキュメントは `apps/backend/src/presentation/routes/*.ts` の実装を基準に、
現行 API のエンドポイント一覧をまとめたものです。

## ベースURL

- ローカル: `http://localhost:8080`
- dev: `https://dev.reitaisai.info`
- prod: `https://reitaisai.info`

## 認証方式

- `auth_token`（Cookie）
  - 発行: `POST /api/auth/login`
  - Better Authの署名付きセッションCookie。DBで検証し、ユーザー情報は `/api/auth/me` で取得する（JWTではない）。
- `access_token`（Cookie）
  - 発行: `POST /api/access-codes/verify`
  - payload: `{ event_id, exp }`

## 共通ヘッダー

- `x-event-id`
  - コンテンツ閲覧・編集 API で使用
  - `contentAccessMiddleware` 適用 API では、
    `access_token` の `event_id` と一致が必要

## エンドポイント一覧

### Health

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/api/health` | 不要 | DB疎通を含むヘルスチェック |

詳細: [health.md](./health.md)

### Auth

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| POST | `/api/auth/login` | 不要 | ログインして `auth_token` を発行 |
| POST | `/api/auth/logout` | 不要 | ログアウト（DBセッション失効・Cookie削除） |
| GET | `/api/auth/me` | `auth_token` 必須 | ログインユーザー情報を返す |
| PUT | `/api/auth/password` | `auth_token` 必須 | パスワード変更 |

### Users

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/api/users` | `auth_token(admin)` | ユーザー一覧取得 |
| POST | `/api/users` | 不要 | ユーザー作成（登録） |
| PUT | `/api/users/:id/role` | `auth_token(admin)` | ユーザーロール変更 |
| PUT | `/api/users/:id/department` | `auth_token(admin)` | ユーザーの所属部署変更 |
| DELETE | `/api/users/:id` | `auth_token(admin)` | ユーザーの論理削除 |

### Access Codes

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/api/access-codes/:id` | `contentAccessMiddleware` | 会期詳細を取得 |
| POST | `/api/access-codes/verify` | 不要 | アクセスコード検証し `access_token` を発行 |
| GET | `/api/access-codes` | `auth_token(admin)` | 会期一覧取得 |
| POST | `/api/access-codes` | `auth_token(admin)` | 会期作成 |
| DELETE | `/api/access-codes/:id` | `auth_token(admin)` | 会期削除 |

### Timetable

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/api/timetable` | `contentAccessMiddleware` | タイムテーブル一覧 |
| POST | `/api/timetable` | `contentEditMiddleware + admin` | タイムテーブル作成 |
| PUT | `/api/timetable/:id` | `contentEditMiddleware + admin` | タイムテーブル更新 |
| DELETE | `/api/timetable/:id` | `contentEditMiddleware + admin` | タイムテーブル削除 |

### Rooms

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/api/rooms` | `contentAccessMiddleware` | 部屋割り一覧 |
| POST | `/api/rooms` | `contentEditMiddleware + admin` | 部屋割り作成 |
| PUT | `/api/rooms/:id` | `contentEditMiddleware + admin` | 部屋割り更新 |
| DELETE | `/api/rooms/:id` | `contentEditMiddleware + admin` | 部屋割り削除 |

### Programs

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/api/programs` | `contentAccessMiddleware` | 企画一覧 |
| POST | `/api/programs` | `contentEditMiddleware + admin` | 企画作成 |
| PUT | `/api/programs/:id` | `contentEditMiddleware + admin` | 企画更新 |
| DELETE | `/api/programs/:id` | `contentEditMiddleware + admin` | 企画削除 |
| POST | `/api/programs/upload` | `contentEditMiddleware + admin` | 企画画像アップロード |

### Shop Items

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/api/shop-items` | `contentAccessMiddleware` | 販売物一覧 |
| POST | `/api/shop-items` | `contentEditMiddleware + admin` | 販売物作成 |
| PUT | `/api/shop-items/:id` | `contentEditMiddleware + admin` | 販売物更新 |
| DELETE | `/api/shop-items/:id` | `contentEditMiddleware + admin` | 販売物削除 |
| POST | `/api/shop-items/upload` | `contentEditMiddleware + admin` | 販売物画像アップロード |

### Departments

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/api/departments` | 不要（全会期共通） | 部署一覧 |
| POST | `/api/departments` | `auth_token(admin)` | 部署作成 |
| PUT | `/api/departments/:id` | `auth_token(admin)` | 部署更新 |
| DELETE | `/api/departments/:id` | `auth_token(admin)` | 部署削除 |

### Others

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/api/others` | `contentAccessMiddleware` | その他情報一覧 |
| POST | `/api/others` | `contentEditMiddleware + admin` | その他情報作成 |
| PUT | `/api/others/:id` | `contentEditMiddleware + admin` | その他情報更新 |
| DELETE | `/api/others/:id` | `contentEditMiddleware + admin` | その他情報削除 |
| POST | `/api/others/upload` | `contentEditMiddleware + admin` | その他情報画像アップロード |

### Search

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/api/search` | `contentAccessMiddleware` | 全コンテンツ横断検索 |

### Assets（API外）

| Method | Path | 認証 | 概要 |
|---|---|---|---|
| GET | `/assets/*` | 不要 | R2バケット上の画像配信 |

## 詳細仕様

- [health.md](./health.md)
- [auth-users.md](./auth-users.md)
- [access-codes.md](./access-codes.md)
- [content.md](./content.md)
- [search.md](./search.md)

## 実装ソース

- ルート定義: `apps/backend/src/presentation/routes/*.ts`
- API マウント: `apps/backend/src/index.ts`
- 認証系ミドルウェア:
  - `apps/backend/src/presentation/middleware/authMiddleware.ts`
  - `apps/backend/src/presentation/middleware/contentAccessMiddleware.ts`
  - `apps/backend/src/presentation/middleware/contentEditMiddleware.ts`
  - `apps/backend/src/presentation/middleware/roleGuard.ts`
