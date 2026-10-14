# Phase 9: Cloudflare Access 段階導入（admin 領域限定）

## 対象

- `docs/development-guide.md`
- `docs/pages/10-dashboard.md`
- `docs/pages/11-admin-access-code.md`

## 目的

Cloudflare Access を `admin` 領域に限定して先行導入し、
既存の `auth_token` / `access_token` 設計を維持したまま
運用性とセキュリティを段階的に向上させる。

## 前提方針

1. 一般ユーザーはログイン操作を行わない前提とする
2. 一般ユーザーは従来どおりアクセスコード認証（`access_token`）のみを利用する
3. Cloudflare Access への全面移行は行わない

## 導入スコープ

1. 保護対象（Phase9）
   - `/dashboard`
   - `/admin/*`
2. 非対象（Phase9）
   - `/`, `/timetable`, `/rooms`, `/events`, `/shop`, `/others`, `/search`
   - user 向けアクセスコード導線（`/access`）
   - user 向け API / middleware の認証方式変更

## 実装順序

backend と frontend とインフラ設定をまたぐため、以下の順序を厳守する。

1. Access 設計・設定（Cloudflare One）
2. Backend 実装
3. Backend テスト
4. Frontend 実装
5. Frontend テスト
6. 段階リリース（dev -> prod）

## 実装内容

1. Cloudflare One で self-hosted application を作成し、対象パスを保護する
   - app 例: `admin.reitaisai.info` または既存ドメインの path ベース保護
2. IdP は Google または Google Workspace を接続し、admin メンバーのみ許可ポリシーを作成する
3. backend に Access JWT 検証ミドルウェアを追加する
   - `Cf-Access-Jwt-Assertion` を優先して検証
   - 検証項目: 署名、`iss`、`aud`、`exp`
4. Access 公開鍵（JWKS）取得とキャッシュ戦略を実装する
   - キーローテーションを前提に定期再取得可能な構成にする
5. admin 系 API に Access JWT 検証ミドルウェアを段階適用する
   - 既存の `auth_token` + `role=admin` 検証は当面維持
6. 二重ゲート期間を設ける
   - Access 通過 + 既存 admin 認証の両方を満たす構成で運用検証
7. frontend 側の admin 導線を Access 前提の遷移に合わせる
   - 未認証時は Access ログインにリダイレクトされる前提を明記
8. 運用ログと監査項目を追加する
   - Access JWT 検証失敗、`aud` 不一致、期限切れ、許可外ユーザー

## 設定値（環境別）

1. `CF_ACCESS_TEAM_DOMAIN`
   - prod/dev で別値を設定
2. `CF_ACCESS_AUD`
   - Access application ごとに発行される AUD を設定
3. `CF_ACCESS_JWKS_URL`
   - `https://<team-domain>/cdn-cgi/access/certs`

## このフェーズでやらないこと

- 全ページを Cloudflare Access で保護する全面移行
- 既存 `auth_token` / `access_token` の廃止
- user 向けコンテンツ閲覧フローの変更
- 一般ユーザー向けにログイン導線を新設する変更
- Managed OAuth の本格導入（必要性評価のみ）

## リスクと対策

1. リスク: 既存認証と Access の二重管理による運用複雑化
   - 対策: admin 領域限定で導入し、手順書を明文化する
2. リスク: Access 設定ミスによる admin ロックアウト
   - 対策: break-glass 用 admin アカウントと緊急手順を用意する
3. リスク: 署名鍵ローテーション時の検証失敗
   - 対策: JWKS 再取得・キャッシュ失効ロジックを実装する

## テスト

### Backend

- `Cf-Access-Jwt-Assertion` なしで admin API が拒否される
- 署名不正 / `aud` 不一致 / 期限切れトークンを拒否する
- 正常トークンで admin API が通過する
- 既存 `auth_token` admin 判定との併用時に回帰しない

### Frontend

- `/dashboard` と `/admin/*` へのアクセス時に Access ログイン導線が成立する
- Access 通過後に既存 UI が正常表示される
- 一般ユーザーが admin 領域へ到達できない

### 運用検証（dev）

- IdP ログイン -> admin 領域アクセスの E2E が成立する
- 失効トークン・許可外ユーザーを正しく拒否できる
- 障害時のロールバック手順（Access 無効化）が実施できる

## 完了条件

- `admin` 領域が Cloudflare Access + 既存 admin 認証で保護される
- `user` 向け既存フローに影響がない
- 一般ユーザーは従来どおりログイン操作不要で利用できる
- `apps/backend` の `type-check`, `test`, `lint` が通る
- `apps/frontend` の `type-check`, `test`, `lint` が通る
- `docs/development-guide.md` と関連 `docs/pages` が Phase9 仕様に追従している
