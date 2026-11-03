# ドキュメント案内

目的に合う資料から読み始めてください。現在の実装と将来計画、作成時点の調査記録を分けています。

## 開発・運用

| 目的 | 入口 |
|---|---|
| 初回セットアップ・ローカル起動 | [プロジェクトREADME](../README.md) |
| 作業規約・Skills・必須チェック・PR | [AGENTS.md](../AGENTS.md) |
| レイヤー構成・テスト・CI・デプロイ・Dependabot | [開発リファレンス](development-guide.md) |
| アプリ固有の設定とコマンド | [Backend](../apps/backend/README.md) / [Frontend](../apps/frontend/README.md) / [Email Worker](../apps/email-worker/README.md) |
| メール認証を公開するための確認 | [Phase 5チェックリスト](checklists/phase5-email-auth-checklist.md) |

コマンドは各 `package.json`、DBは `schema.ts` とmigration、Cloudflare設定は `wrangler.jsonc`、CIは `.github/workflows/` を正本とします。管理画面・DNS・実配送はコードとは別の確認対象です。

## 画面仕様

`pages/`は現行画面の仕様です。管理者・閲覧者の分岐、画面で使うAPIとヘッダーを実装と照合して更新します。

| 画面 | 仕様 |
|---|---|
| ログイン / 登録 / アクセスコード入力 | [01-login](pages/01-login.md) / [02-register](pages/02-register.md) / [03-access](pages/03-access.md) |
| ホーム | [04-home](pages/04-home.md) |
| 時間割 / 部屋割り | [05-timetable](pages/05-timetable.md) / [06-rooms](pages/06-rooms.md) |
| 企画 / 販売物 | [07-events](pages/07-events.md) / [08-shop](pages/08-shop.md) |
| 横断検索 | [09-search](pages/09-search.md) |
| ダッシュボード / アクセスコード管理 | [10-dashboard](pages/10-dashboard.md) / [11-admin-access-code](pages/11-admin-access-code.md) |
| 部署 | [12-departments](pages/12-departments.md) |
| その他情報 | [13-others](pages/13-others.md) |

## API仕様

[API案内](apis/README.md)から [BackendのOpenAPI 3.2.1](apis/openapi.yaml)と [Email Worker内部API](apis/email-worker.openapi.yaml)へ進みます。型・認証・リクエスト/レスポンスはYAML、以下のMarkdownは補足です。[認証・ユーザー](apis/auth-users.md)、[アクセスコード](apis/access-codes.md)、[コンテンツ](apis/content.md)、[検索](apis/search.md)、[ヘルスチェック](apis/health.md)を扱います。

## 利用手順

- [スタッフ向けマニュアル](manuals/user-manual.md): アクセスコードによる閲覧
- [管理者向けマニュアル](manuals/admin-manual.md): 会期とコンテンツの管理

スクリーンショットは `manuals/screenshots/`に保存しています。画像は撮影時点の記録なので、画面変更時は手順と画像をそれぞれ確認してください。

## 計画・確認項目

[ロードマップ](tasks/roadmap.md)が優先順位の入口です。番号は実行順を表しません。各Phaseのタスク文書には目的・設計案・実装条件を、`checklists/`には検証項目を残します。

- [Phase 5 メール認証](tasks/phase5-email-auth-with-email-worker.md)
- [Phase 6 総当たり対策](tasks/phase6-rate-limit-turnstile.md)
- [Phase 10 性能・画像・運用](tasks/phase10-overview.md)
- [Phase 9 Cloudflare Access](tasks/phase9-cloudflare-access-admin.md)
- [Phase 11 RAGチャット](tasks/phase11-rag-chat-modal.md)
- [Phase 7 パスキー](tasks/phase7-passkey-webauthn.md) / [Phase 8 Google OIDC](tasks/phase8-google-oidc-login.md)

タスク文書の存在、チェック項目、PRのマージだけで、計画全体の実装・外部設定・実機検証が完了したとは判断しません。

## 調査・過去の計画

- [Cloudflare機能の導入検討](research/cloudflare-features-investigation.md): 2026年6月の調査。現在の制限・料金・機能は実行前に確認
- [Dependabotへの復帰調査](research/dependabot-return-investigation.md): 2026年10月の再調査・移行判断・初回確認手順
- [依存更新ツールの比較](research/dependency-management-comparison.md): 2026年8月の比較。当時の判断記録。現在の運用は開発リファレンスとDependabot設定を参照
- [Phase 4-6 部署ページの初期計画](archive/phase4-6-frontend-departments-page.md): 現行仕様は [12-departments](pages/12-departments.md)を参照
- [Phase 5の初期実装プラン](archive/phase5-initial-plan.md): 設計の経緯を保存した資料。現行計画はPhase 5タスク文書を参照

## 更新時の扱い

- 現行仕様を変えたら `pages/`・`apis/`と必要なマニュアルを更新する。
- 新しい計画は対応する `tasks/`へ書き、現行仕様へ未実装案を混ぜない。
- 調査は調査日と前提を残す。採用後の操作手順は開発・運用資料へ反映する。
- 移動・改名は参照元も同時更新する。ページの連番と `others`が最後という規約を維持する。
- 検証結果はPRやチェックリストへ記録し、コード確認・テスト・実環境確認を区別する。
