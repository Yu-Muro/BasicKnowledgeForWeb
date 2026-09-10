# 依存関係更新ツール比較検討（Dependabot / Renovate / その他）

> 対象リポジトリ: `basic-knowledge-for-web`（Bun モノレポ / Cloudflare Workers / GitHub Actions）
> 作成日: 2026-08-16
> 結論: **バージョン更新は Renovate（セルフホスト版 GitHub Action）へ移行し、Dependabot はセキュリティアラート専用として残す**ことを推奨。

---

## 1. 結論（先に）

| 順位 | 選択肢 | 一言 |
|---|---|---|
| ◎ **推奨** | **Renovate（セルフホスト: `renovatebot/github-action` を SHA 固定）** + Dependabot alerts | 現状の 2 大課題（PR ノイズ・`bun.lock` 回避策）を両方解消。既存のセキュリティ運用（Action の SHA 固定）とも整合。 |
| ○ 次点 | **Renovate（Mend ホスト版 App）** + Dependabot alerts | 同じ利点を最小工数で。ただし第三者 GitHub App に write 権限を許可する点が既存ポリシーとやや不整合。 |
| △ 現状維持 | **Dependabot を最適化（グルーピング強化）** | 移行ゼロ・低リスクだが、`bun.lock` 回避策と PAT 依存の脆さは残る。 |
| ✕ 非推奨（単独運用） | `bun update` + 自作 cron / Snyk / Socket 等 | 変更履歴・グルーピング・脆弱性情報が弱く、主軸には不向き（補完としては可）。 |

**決め手**: このリポジトリは **Bun ワークスペース（ルート単一 `bun.lock`）** である。
- Renovate は「非ルート `package.json` のみ変更時にルート `bun.lock` が更新されない」既知バグ（[#39586](https://github.com/renovatebot/renovate/issues/39586)）を **[PR #40274](https://github.com/renovatebot/renovate/pull/40274) で修正し、v42.92.6（2026-01-26）でリリース済み**。Renovate 自身が `bun install` を実行し、**同一 PR コミット内**でロックファイルを更新する。
- Dependabot は同種の問題（[#14223](https://github.com/dependabot/dependabot-core/issues/14223) / [#11602](https://github.com/dependabot/dependabot-core/issues/11602)）が **未解決**。このため本リポジトリでは `dependabot-bun-lock.yml` という回避ワークフロー＋PAT が必要になっている。

---

## 2. 現状分析（このリポジトリの実態）

### 使用中の構成
- `.github/dependabot.yml`: `bun` エコシステムを 3 ディレクトリ（`/`, `/apps/backend`, `/apps/frontend`）＋ `github-actions` で設定。
  - `cooldown`（安定化待機日数）、`ignore` で **semver-major を全無視**、backend では `drizzle-orm` / `drizzle-kit`（beta 固定）を無視、frontend では `react` 系をグループ化。
- `.github/workflows/pull-request.yml`: `dependabot-auto-merge` ジョブで **非メジャーを自動承認・自動マージ**（3 つの CI 通過が条件）。
- `.github/workflows/dependabot-bun-lock.yml`: **Dependabot が `bun.lock` を更新できない問題への回避策**。PR 上で `bun install` し直し、差分があればコミット。
  - `GITHUB_TOKEN` の push では後続 CI が再発火しない GitHub の仕様のため、**`secrets.PAT` を優先使用**して push している。

### 課題（＝移行で解決したいもの）
1. **PR / CI の大量発生**: 履歴上 Dependabot 由来のマージ PR は約 **295 件**。1 PR ごとに「backend build+lint+type-check+test」「CockroachDB を起動する migration 検証」「frontend の Cloudflare ビルド+lint+type-check+test」がフル実行され、CI コストが嵩む。
2. **`bun.lock` 回避策の脆さ**: 専用ワークフロー＋PAT に依存。実際に直近で `fix_bun_lockfile_update` / PAT 対応の修正が複数回発生しており、運用負債になっている。

---

## 3. 比較対象と提供形態

| ツール | 提供形態 | インフラ | 費用 |
|---|---|---|---|
| **Dependabot** | GitHub ネイティブ | 不要 | 無料 |
| **Renovate（Mend ホスト App）** | GitHub App（第三者） | 不要 | 無料（OSS/一般利用） |
| **Renovate（セルフホスト）** | `renovatebot/github-action` を cron 実行 | 自リポジトリの Actions | 無料（Actions 時間のみ） |
| その他: `bun update` 自作 | 自作ワークフロー | 自リポジトリ | 無料 |
| その他: Snyk / Socket.dev | SaaS（SCA 中心） | 不要 | 一部有料 |

---

## 4. 評価軸別 比較

| 評価軸 | Dependabot | Renovate | 備考 |
|---|---|---|---|
| **Bun `bun.lock` 更新（ワークスペース）** | △ 未対応の既知バグ → 回避策必須 | ◎ v42.92.6 で修正済み・同一 PR で更新 | **本件の決定打** |
| **セキュリティ更新（Bun）** | ✕ 未 GA（「今後対応」） | ◎ `osvVulnerabilityAlerts` で PR 生成可 | Bun の脆弱性 PR は Renovate が優位 |
| **セキュリティ *アラート*（可視化）** | ◎ GitHub Advisory 統合・ネイティブ | ○ 同等の検知は可能 | アラートは Dependabot を残すのが手軽 |
| **PR ノイズ削減（グルーピング）** | △ 基本的なグループのみ | ◎ 高度なグループ／プリセット／ダッシュボード | 295 PR → 数分の 1 に圧縮可能 |
| **Dependency Dashboard（一覧 Issue）** | ✕ なし | ◎ あり | 保留中更新を 1 Issue で俯瞰 |
| **スケジューリング** | ○ interval のみ | ◎ cron 風の柔軟指定 | 「平日夜のみ」等が可能 |
| **安定化待機** | ○ `cooldown` | ◎ `minimumReleaseAge` | ほぼ同等、Renovate が細かい |
| **設定表現力** | △ シンプル | ◎ `packageRules` / preset / regex manager | beta 固定や個別無効化が容易 |
| **自動マージ** | ○ 自作ジョブで実装済み | ◎ `automerge` 標準搭載 | Renovate は設定だけで完結 |
| **CI 再発火 / PAT** | ✕ `GITHUB_TOKEN` push が再発火せず PAT 依存 | ◎ 同一コミットで更新→通常発火・PAT 不要 | 回避ワークフロー自体が不要に |
| **導入の手軽さ** | ◎ ネイティブ | ○ App: 即 / セルフホスト: 要設定 | |
| **第三者 App 権限** | ◎ 不要 | App版=要 / **セルフホスト=不要** | セキュリティ方針的にセルフホスト推奨 |
| **学習コスト** | ◎ 低い | △ 設定が高機能ゆえ学習要 | |

### 事実確認の出典
- Dependabot は 2025-02-13 に **bun を GA** サポート（`npm_and_yarn` エコシステム内）。テキスト形式 `bun.lock`（Bun ≥1.1.39）対応、バイナリ `bun.lockb` は非対応。**Bun のセキュリティ更新は「今後対応」**（未 GA）。
- Dependabot の Bun ワークスペース `bun.lock` 未更新問題は **未解決**（#14223 / #11602）。加えて `configVersion` 行の削除問題（#13623）も既知。
- Renovate の `bun` マネージャは `bun.lock(b)` + `package.json` を検出し、`lockFileMaintenance` に対応。ロック更新は **Renovate 自身が `bun install` を外部実行**。ワークスペース `bun.lock` 未更新バグは **v42.92.6 で解消**。

---

## 5. なぜこのプロジェクトでは Renovate が勝るか

1. **`bun.lock` 回避策（`dependabot-bun-lock.yml`）を丸ごと廃止できる。**
   Renovate は PR を作る同一実行内で `bun install` を回し、ルート `bun.lock` を同じコミットに含める。「Dependabot の PR に別ワークフローが後追いで `bun.lock` を push する」という二段構えが不要になり、運用負債が 1 つ消える。
   認証には専用 GitHub App の短期インストールトークンを使うため、個人アカウントに紐付く PAT は不要。App トークンで作成した PR は後続 CI を発火でき、`platformCommit` により GitHub App の署名も付与できる。
2. **PR / CI 爆発をグルーピングで抑制。**
   例: 「全 devDependencies を 1 PR」「Cloudflare 系（wrangler / @cloudflare/*  / @opennextjs/*）を 1 PR」「React エコシステムを 1 PR」等。約 295 件規模の PR とフル CI 実行を大幅に削減。Dependency Dashboard で保留状況も一望できる。
3. **beta 固定パッケージの制御が明快。**
   `drizzle-orm` / `drizzle-kit`（`1.0.0-beta.x`）は `packageRules` で `enabled:false`、メジャーは `matchUpdateTypes:["major"]` → `enabled:false`、安定化は `minimumReleaseAge` と、現行 `dependabot.yml` の意図をそのまま・より細かく表現できる。
4. **既存のセキュリティ運用と整合。**
   本リポジトリは Action を SHA 固定し、AikidoSec / Betterleaks / zizmor / anti-trojan-source を回している。**セルフホスト Renovate（`renovatebot/github-action` を SHA 固定 + 最小権限トークン）**なら、第三者 App に write を渡さずに同じ思想で運用できる。

**注意（Renovate でも要検証）**: ワークスペースのロック更新は改善済みだが、モノレポ固有の端ケースは残りうる（例: プライベート内部パッケージ `backend` の解決）。**本番移行前に検証用ブランチで 1 サイクル回す**こと。

---

## 6. 実施した移行内容

本比較の結論に基づき、**セルフホスト Renovate へ移行済み**（ブランチ `chore/renovate-migration`）。

### 6.1 変更ファイル

| 種別 | ファイル | 内容 |
|---|---|---|
| 追加 | `renovate.json` | Renovate 設定（旧 `dependabot.yml` の意図を全て移植） |
| 追加 | `.github/workflows/renovate.yml` | セルフホスト実行（`renovatebot/github-action` を SHA 固定、Renovate 本体も `renovate-version` で固定） |
| 削除 | `.github/dependabot.yml` | バージョン更新は Renovate へ移管 |
| 削除 | `.github/workflows/dependabot-bun-lock.yml` | **回避策が不要になったため撤去** |
| 変更 | `.github/workflows/pull-request.yml` | `dependabot-auto-merge` → `renovate-auto-merge` |
| 変更 | `.github/workflows/auto-assign.yml` | `renovate/` ブランチをレビュアー自動アサインから除外 |
| 変更 | `CLAUDE.md` / `AGENTS.md` | CI/CD 章と必須シークレット表を更新 |

> `.github/dependabot.yml` の削除で止まるのは **バージョン更新のみ**。Dependabot **alerts**（脆弱性の可視化）はリポジトリ設定側の機能なので有効なまま維持されます。

### 6.2 設定マッピング（旧 `dependabot.yml` → `renovate.json`）

| 旧 `dependabot.yml` | `renovate.json` での表現 |
|---|---|
| `interval: weekly` | `"schedule": ["before 9am on monday"]` + `"timezone": "Asia/Tokyo"` |
| `cooldown.default-days: 7` | `"minimumReleaseAge": "7 days"` |
| `cooldown.semver-patch-days: 3` | `packageRules`: `matchUpdateTypes:["patch"]` → `"minimumReleaseAge": "3 days"` |
| `ignore: semver-major (*)`（bun 3 設定のみ。`github-actions` 設定には無し） | `packageRules`: `matchUpdateTypes:["major"]` → `"enabled": false`。ただし後続ルールで `github-actions` の major のみ `"enabled": true` に戻し、旧挙動を維持 |
| backend: `drizzle-orm`/`drizzle-kit` 無視 | `packageRules`: 該当 2 件を `"enabled": false` |
| frontend: `react` グループ | `packageRules`: `groupName: "react"` |
| `github-actions` エコシステム | `github-actions` マネージャ（`config:recommended` に含む）+ `pinDigests` |
| 3 ディレクトリ個別指定 | 不要（ワークスペースを自動検出し、ルート `bun.lock` を一括更新） |
| `dependabot-auto-merge` ジョブ（`update-type != semver-major` を判定） | `renovate-auto-merge` ジョブ（ブランチ名 + PR 作成者 + ベースブランチ + `major-update` ラベル不在を判定） |

**追加したもの**（Dependabot では実現できなかった項目）:
- `osvVulnerabilityAlerts: true` — Bun 依存の脆弱性更新 PR（Dependabot は bun 未対応）
- `lockFileMaintenance` — 月次で `bun.lock` を再生成
- `dependencyDashboard` — 保留中更新を 1 Issue で俯瞰
- Cloudflare / テストツール のグルーピング — CI 実行回数をさらに削減
- `ignoreDeps: ["backend"]` — ワークスペース内部パッケージの誤更新防止
- `customManagers` — `renovate.yml` で固定した Renovate 本体（`ghcr.io/renovatebot/renovate`）自身を更新対象に含める

**PR 数の制限について:** 通常更新のブランチ作成が許されるのは `schedule` により週 1 回（毎週月曜 07:00 JST の起動）だけなので、1 回の実行で作れる PR 数がそのまま週あたりの上限になります。移行前 90 日間の Dependabot マージ実績は 100 件（約 7.7 件/週）で、グルーピング後も週 5 件前後は見込まれます。そのため `prHourlyLimit` は `0`（無制限）とし、`prConcurrentLimit: 10` を唯一の制限としています。時間あたりの上限を残すと、その値がそのまま週あたりの上限になり恒常的なバックログが生じます。
- コミットメッセージ / PR 本文の日本語化（`CLAUDE.md` の規約に準拠）

### 6.3 マージ前に必要な手動セットアップ ⚠️

1. **Renovate 専用 GitHub App を作成して `BasicKnowledgeForWeb` のみにインストールする**
   - Repository permissions は Administration: Read-only、Checks / Commit statuses / Contents / Issues / Pull requests / Workflows: Read and write、Dependabot alerts: Read-only とする。
   - Webhook は使用しないため無効化する。
   - GitHub App の秘密鍵を生成し、リポジトリの Actions Secret `RENOVATE_APP_PRIVATE_KEY` に PEM 全文を登録する。秘密鍵をリポジトリへコミットしないこと。
   - GitHub App の Client ID を Actions Variable `RENOVATE_APP_CLIENT_ID` に登録する。
   - ワークフローは `actions/create-github-app-token` で実行ごとに短期インストールトークンを生成する。静的な PAT は使用しない。
   - `RENOVATE_PLATFORM_COMMIT: "enabled"` により GitHub API 経由でコミットし、GitHub App の署名を付ける。
2. **`RENOVATE_ACTOR` 変数を登録する**（`Settings → Secrets and variables → Actions → Variables`）
   - 値は GitHub App の `<app-slug>[bot]`（例: `rts-souhon-renovate[bot]`）。
   - `renovate-auto-merge` が PR 作成者の検証に使用します。**未設定の場合は自動マージが行われません**（fail-closed）。ブランチ名だけを条件にすると、書き込み権限を持つ利用者が `renovate/*` ブランチから PR を作るだけでレビュー要件を迂回できてしまうため、この検証を必須にしています。
3. **設定が `main`（デフォルトブランチ）へ到達するまで Renovate は起動しません。**
   - ワークフローに `RENOVATE_REQUIRE_CONFIG: "required"` / `RENOVATE_ONBOARDING: "false"` を設定済み。デフォルトブランチに `renovate.json` が無い間は**何もせずスキップ**します（オンボーディング PR の暴発や `main` 宛て PR の誤作成を防止）。
   - よって有効化は `develop` → `main` のリリース後になります。
4. **初回は必ずドライランで確認する。**
   - Actions から `Renovate` ワークフローを `workflow_dispatch` で実行し、`dryRun` に `full` を指定 → PR を作らずログのみ出力。
   - 想定どおりのグルーピング・対象になっていることを確認してから通常実行へ。

### 6.4 検証済みの内容

- `renovate.json` は Renovate 公式の `renovate-config-validator` で **`Config validated successfully`**（警告・移行提案なし）を確認済み。
- `customManagers` の正規表現が `renovate.yml` の `renovate-version` 行から `depName=ghcr.io/renovatebot/renovate` / `datasource=docker` / `currentValue` を抽出できることを、同じ正規表現をローカルで実行して確認済み。
- `renovatebot/github-action` の `renovate-version` 既定値がメジャータグ `'44'`（`action.yml:28`）であり、固定しなければ実行ごとにイメージ実体が変わることを確認済み。
- Renovate が PR 作成（`createPr`）とラベル付与（`addLabels`）を別 API 呼び出しで行うことを、`lib/modules/platform/github/index.ts`（v44.0.0）でソース確認済み。`renovate-auto-merge` がラベルを実行時に再取得する根拠。
- `develop` の保護は従来のブランチ保護ではなく **ruleset**（`Protect develop branch`、enforcement: active）で実装されていることを API で確認済み。承認 1 件・必須ステータスチェック 4 件・レビュースレッド解決・署名必須が有効。`CODEOWNERS` は未設置のため `require_code_owner_review` は実質無効で、`github-actions[bot]` の承認 1 件で必要条件を満たす。`RENOVATE_ACTOR` を専用 GitHub App の bot アカウントに限定する根拠。
- 移行前 90 日間（2026-05-18 以降）の Dependabot マージ実績が 100 件であることを Search API で確認済み。PR 数制限の設定根拠。
- スケジュール実行時に `RENOVATE_DRY_RUN` が空文字になる件は、Renovate の env パーサが `if (!envVal) continue`（`lib/workers/global/config/parse/env.ts`）で空値をスキップする実装であることをソースで確認済み。定期実行に影響しません。
- 上記はいずれも静的検証です。**実際の PR 生成挙動（特に Bun ワークスペースでの `bun.lock` 更新）は、6.3 のドライラン → 初回実行で必ず確認してください。**

---

## 7. 各選択肢の採否理由（サマリ）

- **Renovate セルフホスト（◎）**: 2 大課題を解消し、第三者 App 権限も不要でセキュリティ方針と整合。学習・初期設定コストは要許容。
- **Renovate Mend App（○）**: 利点は同じで最小工数。ただし第三者 App に contents/PR write を許可。信頼度は高い（広く普及）が、SHA 固定文化とは思想が異なる。
- **Dependabot 最適化（△）**: グルーピング強化で PR ノイズは減るが、**`bun.lock` 回避策・PAT・Bun セキュリティ更新未対応**という根本課題は残る。移行工数ゼロを最優先する場合のみ。
- **`bun update` 自作 cron（✕ 主軸不可）**: 変更履歴・グルーピング・脆弱性情報を自作で賄う必要があり ROI が悪い。補完用途に留める。
- **Snyk / Socket.dev（✕ 代替不可 / 補完可）**: SCA・脆弱性検知が主目的で、バージョン更新自動化の主軸にはならない。既に AikidoSec Safe Chain 相当を導入済み。

---

## 8. リスク・留意点

- **Renovate モノレポ端ケース**: ワークスペース内部依存（`backend`）や private 解決で稀に失敗例あり。移行前に検証ブランチで実 PR を 1 サイクル確認。
- **Renovate バージョン固定**: セルフホスト Action は SHA 固定しつつ、**ロック更新バグ修正済みの v42.92.6 以降**を使うこと。
- **セキュリティの二重化**: バージョン更新=Renovate、脆弱性アラート可視化=Dependabot alerts の併用が無難。Renovate 側 `osvVulnerabilityAlerts` を使うなら役割の重複を整理。
- **自動マージの安全弁**: 必須 CI（backend/ migration / frontend）を Branch protection の Required checks に設定し、緑でなければマージされない状態を維持。

---

## 参考リンク

- Dependabot: bun 対応 GA（2025-02-13） — https://github.blog/changelog/2025-02-13-dependabot-version-updates-now-support-the-bun-package-manager-ga/
- Dependabot supported ecosystems — https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories
- Dependabot: bun.lock がワークスペースで更新されない（未解決） — https://github.com/dependabot/dependabot-core/issues/14223 , https://github.com/dependabot/dependabot-core/issues/11602
- Renovate: bun マネージャ Docs — https://docs.renovatebot.com/modules/manager/bun/
- Renovate: ワークスペース bun.lock 未更新バグ（Closed） — https://github.com/renovatebot/renovate/issues/39586
- Renovate: 修正 PR（v42.92.6 で提供） — https://github.com/renovatebot/renovate/pull/40274
- Renovate GitHub Action（セルフホスト） — https://github.com/renovatebot/github-action
