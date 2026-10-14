---
name: add-domain
description: バックエンドに新しいドメインやリソースを追加するときに使う。Clean Architecture 各層の実装順序、CockroachDB 複合FKの落とし穴、テストと認証ミドルウェア適用までの必須手順をガイドする。
---

# 新ドメイン追加ガイド

このリポジトリに新しいコンテンツAPIを追加する手順。既存リソースの修正では、必要な工程だけを適用する。

## 前提
- 作業先: このSkillを含むリポジトリ（worktreeではそのルート）
- 依存関係: ルート `AGENTS.md` と既存 skill 群
- Clean Architecture: routes → controllers → use cases → repositories → db
- すべての GET コンテンツ API に `contentAccessMiddleware` を適用すること

## 実装順序
1. **Schema — `apps/backend/src/db/schema.ts`**
   - `cockroachTable` + `uuid('id').defaultRandom().primaryKey()`。
   - `event_id`: `uuid('event_id').notNull().references(() => accessCodes.id, { onDelete: 'restrict' })`。
   - `created_at` / `updated_at`: `timestamp(...).defaultNow()`。
   - 複合 FK はテーブルコールバックで `foreignKey` を宣言し、先に対応する `uniqueIndex` を定義。
   - CockroachDB では migration 内で `CREATE UNIQUE INDEX IF NOT EXISTS ...` を **必ず** `ADD CONSTRAINT ... FOREIGN KEY` より前に置く。

2. **マイグレーション**
   ```bash
   cd apps/backend
   bun run db:generate
   # drizzle/<timestamp>_*/migration.sql を開いて FK 順序を確認
   bun run db:migrate
   ```
   Drizzle が FK → INDEX の順に生成した場合は手動で並べ替える。

3. **Repository Interface** — `src/infrastructure/repositories/<domain>/I{Name}Repository.ts`
   - 例: `findByEventId(eventId: string): Promise<{Name}[]>;`
   - 利用側が必要とするメソッドだけを宣言。

4. **Repository Implementation** — `src/infrastructure/repositories/<domain>/{Name}Repository.ts`
   - Drizzle クエリ実装はここだけで行う。
   - `eq`, `asc` を `drizzle-orm` から、`alias` が必要なら `drizzle-orm/cockroach-core` からインポート。
   - 並び順や JOIN はドキュメント仕様に合わせる。soft delete された行は返さない。

5. **Validator** — `src/infrastructure/validators/{domain}Validator.ts`
   - Zod で `x-event-id` ヘッダーやリクエスト DTO、レスポンス DTO を定義。
   - フロントエンドからも `@backend/...` を介して再利用可能にする。

6. **Use Case Interface / Implementation** — `src/use-cases/{domain}/`
   - 返り値は `{ success: true; data: T } | { success: false; error: string }` の discriminated union。
   - ビジネスロジック（フィルタや代替テキスト）は use case に閉じ込める。

7. **Controller** — `src/presentation/controllers/{domain}Controller.ts`
   - `IGet{Name}sUseCase` などインターフェースのみ依存。
   - `x-event-id` が無い場合は `400` を返し、use case の結果に応じてステータスを分岐。

8. **Routes** — `src/presentation/routes/{domain}Routes.ts`
   - Composition Root。repository + use case を組み合わせて controller を呼び出す。
   - 例:
     ```typescript
     app.get('/<resource>', contentAccessMiddleware, (c) => controller.handle(c));
     ```

9. **Mount** — `src/index.ts`
   `/api` はmount側で付ける。route内で重ねて付けない。
   ```typescript
   import { create<Name>Routes } from './presentation/routes/<domain>Routes';
   app.route('/api', create<Name>Routes());
   ```

10. **Tests** — 実装後に追加する
    | レイヤー | パス | 確認事項 |
    | --- | --- | --- |
    | Validator | `tests/infrastructure/validators/<domain>Validator.test.ts` | 必須フィールド / UUID |
    | Repository | `tests/infrastructure/repositories/<domain>/{Name}Repository.test.ts` | クエリチェーン / 並び順 |
    | Use Case | `tests/use-cases/<domain>/Get{Name}sUseCase.test.ts` | 成功/失敗分岐 |
    | Controller | `tests/presentation/controllers/{domain}Controller.test.ts` | HTTP ステータス / レスポンス |
    | フィーチャー | `tests/features/{domain}.test.ts` | access_token / auth_token(admin) / 401 の分岐 |

    Feature テストのポイント:
    - `JWT_SECRET` を `app.request(..., mockEnv)` の第3引数で渡す。
    - `role=user` の `auth_token` は必ず `401` になることを確認。
    - `access_token.payload.event_id` と `x-event-id` が一致しない場合の拒否もテスト。

## 完了チェックリスト
- `cd apps/backend && bun run type-check`
- `bun run lint`（必要なら `bun run lint:fix`）
- `bun run test`
- フロントエンドの実装は backend が完了してから着手
