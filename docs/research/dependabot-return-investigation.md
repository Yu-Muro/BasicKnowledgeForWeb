# Dependabotへの復帰調査と移行判断

確認日: 2026-10-29。対象: `Yu-Muro/BasicKnowledgeForWeb` の `develop`。

## 採用した方針

ユーザーはBunのセキュリティ修正を手動対応する制約を許容し、通常更新を毎日にしてDependabotへ戻すことを選択した。ルートのBun設定とGitHub Actions設定を各1件に集約し、Renovateの実行・本体更新・専用App・Dashboardの保守を通常更新から外す。

## 現行仕様と実装で確認したこと

| 確認対象 | 結果と判断 |
|---|---|
| Bunのサポート | GitHub公式対応表ではテキスト形式 `bun.lock` の通常更新に対応。2026-10-20にBun 1.4対応も案内済み。本リポジトリは `lockfileVersion: 1` / `configVersion: 0` |
| ワークスペース取得 | 現行 `FileFetcher` はルートの `workspaces` を展開して各 `package.json` を取得する。`apps/*` と共通の `bun.lock` をルート1設定で扱う |
| ロック更新 | 現行 `BunLockfileUpdater` は宣言元のワークスペースごとに `bun install ... --filter ./apps/... --save-text-lockfile --ignore-scripts` を実行し、最終manifestを書き戻したうえでロックを更新する |
| 上流の回帰テスト | ワークスペースだけで宣言する依存、複数ワークスペースで共有する依存、ルートに不要な依存を追加しないこと、lockfile version維持などのケースが存在する。これらをローカルで実行したという意味ではない |
| 過去のIssue | #11602・#13623はクローズ済み。#14223も2026-09-24に完了したが、修正はBunをnpmエコシステムに誤設定した場合の検出。Issueのクローズだけを本リポジトリでの更新成功の証拠にはしていない |
| Bunのセキュリティ修正PR | 公式対応表では未対応。Renovateの `osvVulnerabilityAlerts` 相当をDependabotで代替できるとは判断しない。ユーザー判断により手動対応とする |
| スケジュール | `daily` は平日のみ。土日を含む毎日07:00 JSTの確認には `cron` を使う |

## 変更内容

- [Dependabot設定](../../.github/dependabot.yml)を追加し、BunとGitHub Actionsを毎日確認。PRの宛先は `develop`。
- React・Cloudflare/OpenNext・テストツールのグループ化、Bunは原則7日・パッチ3日、GitHub Actionsは7日の待機、各エコシステム10件のPR上限を設定。
- Bunのmajor・固定運用のDrizzle・内部パッケージ `backend` を除外。GitHub Actionsのmajorはグループから分離して手動レビュー。
- 自動マージをDependabot本人のminor/patchに限定。4ジョブ成功、メタデータ検証、実行時のPR再確認とコミットSHA一致を条件にする。major・空の更新種別・API失敗では承認もマージも行わない。
- Renovate設定・workflowを撤去。旧 `dependabot-bun-lock.yml` やPATによる後追いコミットは復活させない。
- 保留中のNext.jsセキュリティ修正15.5.28を適用。OpenNext 1.20.2の期限判定がNext.js 15の継続サポートに追随せずビルドが停止したため、修正版1.20.13も適用してBunで共通ロックを再生成する。サポート判定の無効化は行わない。ロック再生成時にも7日以上経過した版だけを選び、Safe Chainの待機期間検査を維持する。
- 日本語prefixを設定する。Dependabotの固定文言・本文は英語となる。

## 検証範囲

ローカルではDockerソケットへのアクセスと外部DNS解決が制限されているため、Dependabot updaterコンテナの実行とGitHubホスト上での初回PR生成は未検証。上流ソース・回帰テストの存在確認と、今回のYAML・自動マージ条件の検証を区別する。

検証済み: 全workflowとDependabot設定のYAML解析、日次スケジュール・除外・グループ・ローカルAction参照、自動マージの実行主体/宛先/forkの5ケース、更新種別18ケース、実際のshell/`jq`を使ったPR再確認8ケース（コミット差し替え・宛先変更・API失敗など）。

Backend・Email Workerのアプリ本体と画面仕様は変更しない。FrontendのNext.js/OpenNextパッチ更新と共通`bun.lock`再生成を含むため、Frontendのbuild・型検査・lint・テストを既存のPRチェックで確認する。

## マージ後の確認と整理

1. デフォルトブランチ `develop` にこの設定が反映されてからDependabotが有効になる。Issue #465のDashboardは、この移行PRのマージと合わせて閉じる。
2. 最初のBun更新PRで、対象アプリの `package.json` と共通 `bun.lock` が整合していること、4ジョブとセキュリティチェックが成功することを確認する。lockfileだけを更新するPRではmanifest変更が不要な場合もある。
3. minor/patchでは自動承認・マージの結果を、GitHub Actionsのmajorでは自動処理されないことを確認する。マージ後のdevデプロイも確認する。
4. 旧 `renovate/github-actions` / `renovate/npm-next-vulnerability` は、必要な未反映差分がないかを確認してから整理する。今回の変更でブランチは削除しない。
5. 他の用途がないことを確認したうえで、Renovate専用Appと `RENOVATE_APP_PRIVATE_KEY` / `RENOVATE_APP_CLIENT_ID` / `RENOVATE_ACTOR` を整理できる。今回の変更で外部のsecret・変数・App設定は削除しない。
6. 脆弱性情報や `bun audit` を確認し、修正は通常更新の待機を待たずに手動適用する。既存Dashboardで保留されていたNext.js更新も、この確認から除外しない。

復旧が必要な場合は、この移行PRをrevertしてRenovate設定・workflowを戻す。切り替え確認までは専用Appの登録を保持する。

## 根拠

- [GitHub公式の対応表](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories)（[表の原本](https://github.com/github/docs/blob/main/data/reusables/dependabot/supported-package-managers.md)）
- [Bun 1.4対応の告知](https://github.blog/changelog/2026-10-20-dependabot-now-supports-npm-12-pnpm-11-and-12-and-bun-1-4/)
- [現行FileFetcher](https://github.com/dependabot/dependabot-core/blob/main/bun/lib/dependabot/bun/file_fetcher.rb)
- [現行BunLockfileUpdater](https://github.com/dependabot/dependabot-core/blob/main/bun/lib/dependabot/bun/file_updater/bun_lockfile_updater.rb)
- [上流のFileUpdater回帰テスト](https://github.com/dependabot/dependabot-core/blob/main/bun/spec/dependabot/bun/file_updater_spec.rb)
- [#14223](https://github.com/dependabot/dependabot-core/issues/14223)、[#11602](https://github.com/dependabot/dependabot-core/issues/11602)、[#13623](https://github.com/dependabot/dependabot-core/issues/13623)
- [Dependabot設定リファレンス](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
- [DependabotとActionsの自動化](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/automate-dependabot-with-actions)

- [OpenNextのNext.js 15継続サポート修正](https://github.com/opennextjs/opennextjs-aws/pull/1321)
- [Next.jsサポート方針](https://nextjs.org/support-policy)
