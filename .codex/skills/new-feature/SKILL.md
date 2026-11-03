---
name: new-feature
description: 新機能を実装するときの標準フロー。developからのブランチ作成、backend→frontendの実装順序、各チェックとPR作成ルールを網羅する。
---

# 新機能実装ワークフロー

このリポジトリで新機能を安全に進めるための標準フロー。Backend→Frontend の順序を必ず守ること。

対象アプリに変更がある工程だけを行う。Frontendだけの変更でBackend実装を追加せず、BackendとFrontendにまたがる場合は上記順序を守る。Email Workerの変更は `cloudflare-email-service` と同アプリの必須チェックを併用する。

## 0. ブランチ作成
作業開始前に `git status` と現在のブランチを確認する。既存の未コミット変更や継続中の作業がある場合は、その内容を保持して作業先を決める。

新規作業でブランチを作る場合:
```bash
git checkout develop
git pull origin develop
git checkout -b codex/<task-name>
```
Codexの既定prefixは `codex/`。ユーザーの明示指定があればそれに従う。`develop` へ直 push せず、無関係な差分を混ぜない。

## 1. Backend を先に完了
1. 新しいリソースなら `add-domain` Skillで schema→repo→use case→controller→route→index を実装。
2. `apps/backend` で以下をすべて PASS させる:
   ```bash
   bun run type-check
   bun run lint
   bun run test
   ```
3. 未通過のまま次工程へ進まない。

## 2. Backend コミット
- Conventional Commits + 日本語（例: `feat(rooms): GET /api/rooms エンドポイントを追加`）。
- レイヤー単位でコミットを分割し、失敗中のチェック状態ではコミットしない。
- 既存変更が混在する場合は、今回の対象ファイルだけを stage する。

## 3. Frontend 実装
1. `apps/frontend/app/`（Next.js App Router）配下で作業。`(authenticated)` などのレイアウト構造を尊重。
2. バリデーションは `@backend/infrastructure/validators/...` から共有。
3. Client Component は `'use client'` + `react-hook-form` + `zodResolver` を使用。
4. API 呼び出し時は `resolveAuth` / `buildContentFetchHeaders` など既存 helper を使い、`access_token` / `x-event-id` 契約を順守。

## 4. Frontend チェック & コミット
```bash
cd apps/frontend
bun run type-check
bun run lint
bun run test
```
通過後に日本語 Conventional Commit でフロント変更を記録（例: `feat(home): 認証済みホームを追加`）。

## 5. プルリクエスト
```bash
git push -u origin <branch>
gh pr create --base develop --title "<prefix>(<scope>): <日本語タイトル>"
```
`.github/pull_request_template.md` に準拠して日本語で記入。ターゲットは `develop` 固定。

## 6. 完了チェックリスト
- [ ] ブランチは `develop` から切ったか
- [ ] Backendに変更がある場合、`apps/backend` の `type-check` / `lint` / `test` が通過した
- [ ] Frontendに変更がある場合、`apps/frontend` の `type-check` / `lint` / `test` が通過した
- [ ] Email Workerに変更がある場合、`apps/email-worker` の `type-check` / `lint` / `test` が通過した
- [ ] コミットメッセージ: 日本語 + Conventional Commits
- [ ] PR タイトル・本文: 日本語 + テンプレ準拠
- [ ] BackendとFrontendの両方に変更がある場合、Backend実装・テストを完了してからFrontendを実装・テストした
- [ ] `git status` で意図しない差分が混ざっていない
