# タスク優先度ロードマップ

作成日: 2026-06-30

Phase 1〜4（認証基盤・コンテンツ・検索・管理機能）はプロダクト基盤として概ね完了/進行中。
本書は **残タスクを優先度順に整理した唯一の基準** とする。

> **注意:** 番号変更を最小化したため、ファイル番号は優先度順と完全には一致しない（性能/UX/運用は Phase 10、passkey/OIDC/Access は 7/8/9 のまま据え置き）。**実行順は必ず本書の「推奨実行順」に従うこと。**

調査の根拠は [Cloudflare 機能の導入検討レポート](../cloudflare-features-investigation.md)、全体設計は [implementation-plan.md](../implementation-plan.md) を参照。

---

## 凡例

- **区分**: セキュリティ / 性能 / 運用 / UX / 機能 / 認証
- **状態**: 実装中（PR オープン） / 計画済（既存ドキュメントあり・未着手） / 新規（本対応で作成）
- **工数**: 極小（設定のみ） / 小 / 中 / 大
- **コスト**: 無料 / 無料枠 / 従量 / プラン依存 / 送信基盤依存

## 進行中

| フェーズ | 区分 | 内容 | 状態 |
|---|---|---|---|
| [5](https://github.com/RTS-souhon/BasicKnowledgeForWeb/pull/167) | 認証/機能 | メール認証基盤（メール検証 / OTP ログイン / 信頼デバイス、`apps/email-worker` 分離 + Service Binding） | 実装中（PR #167） |

> Phase 5 は Cloudflare の **Email Workers + Service Bindings** を用いた認証強化。マージ後のタスク doc は `docs/tasks/phase5-email-auth-with-email-worker.md`。

## 推奨実行順（未着手分）

| 順 | フェーズ | 区分 | 内容 | 状態 | 工数 | コスト |
|---|---|---|---|---|---|---|
| 1 | [**6**](./phase6-rate-limit-turnstile.md) | セキュリティ | **総当たり対策（Rate Limiting + Turnstile）★最優先** | 新規 | 小 | 無料 |
| 2 | [10-1](./phase10-1-edge-optimization.md) | 性能 | エッジ最適化（Hyperdrive キャッシュ + Smart Placement） | 新規 | 極小 | 無料 |
| 3 | [10-2](./phase10-2-waf-analytics.md) | 運用 | 境界防御・計測（WAF ルール + Web Analytics） | 新規 | 小 | プラン依存 |
| 4 | [10-3](./phase10-3-image-optimization.md) | UX | 画像最適化（Cloudflare Images Transformations） | 新規 | 中 | 無料枠 |
| 5 | [9](./phase9-cloudflare-access-admin.md) | セキュリティ | Cloudflare Access（admin 領域限定） | 計画済 | 中 | 無料 |
| 6 | [11](./phase11-rag-chat-modal.md) | 機能 | Workers AI (AI Search) RAG チャット | 計画済 | 大 | 従量 |
| 7 | [7](./phase7-passkey-webauthn.md) | 認証 | パスキー（WebAuthn） | 計画済 | 中 | 無料 |
| 8 | [8](./phase8-google-oidc-login.md) | 認証 | Google OIDC ログイン | 計画済 | 中 | 無料 |

## 優先度の考え方

1. **進行中の Phase 5（メール認証）を完遂**: 既に PR #167 が進行中。OTP/メール検証は新たな認証面を増やすため、下記 Phase 6 の保護対象に含める（後述の依存関係）。
2. **アプリの穴を最優先で塞ぐ**: `POST /api/access-codes/verify` は「誰でも可」かつ回数無制限で総当たりが可能。`POST /api/auth/login` も同様。**総当たり対策を Phase 6（最優先）に昇格**し、まず塞ぐ。ゾーン側 WAF（Phase 10-2）と二重化する。
3. **設定で効く性能改善を即取り込む**: Hyperdrive キャッシュ調整と Smart Placement（Phase 10-1）はコード変更が極小でレイテンシ改善が見込める。
4. **運用可視化と来場体験**: 境界防御・計測（10-2）→ 画像最適化（10-3）。
5. **その後に大型/運用系**: Cloudflare Access（9）→ 価値の大きい大型機能 RAG（11）→ 認証 UX（7 → 8。8 は 7 のマルチログイン前提に依存）。

> **番号と優先度の関係:** 番号変更を最小化するため、性能/UX/運用は Phase 10、既存の passkey/OIDC/Access は 7/8/9 のまま据え置き、セキュリティに Phase 6 を割り当てた都合で **RAG のみ旧 Phase 6 から Phase 11 へ移動**した。優先順位は本書で管理する。

## 依存関係メモ

- **Phase 5 → Phase 6**: Phase 5 の OTP ログイン / メール検証 verify エンドポイント（特に数桁 OTP）は総当たりの標的。Phase 5 マージ後、Phase 6 の Rate Limiting / Turnstile 保護対象に追加する。
- **Phase 6 ↔ Phase 10-2**: アプリ側（Phase 6）とゾーン側 WAF（10-2）でレート制限を二重化する。
- **Phase 8 → Phase 7**: Google OIDC（8）はパスキー（7）導入後のマルチログイン基盤を前提とする。

---

## 各フェーズ概要

### Phase 5: メール認証基盤（実装中・PR #167）

`apps/email-worker` を分離し、Service Binding（`EMAIL_WORKER`）経由で backend から呼び出す構成。メール検証 / OTP ログイン / 信頼デバイス（30 日）を実装予定。Cloudflare の Email Workers を活用。詳細は [PR #167](https://github.com/RTS-souhon/BasicKnowledgeForWeb/pull/167)。

### Phase 6: アクセスコード/ログインの総当たり対策（新規・最優先）

Workers Rate Limiting + Turnstile で verify/login のブルートフォースを抑止。現状の穴を塞ぐ最優先タスク。詳細は [Phase 6](./phase6-rate-limit-turnstile.md)。

### Phase 10: Cloudflare 基盤強化（性能・UX・運用）（新規）

設定中心で効く性能・UX・運用改善群。詳細は [Phase 10 タスク一覧](./phase10-overview.md)。

- [10-1 エッジ最適化（Hyperdrive キャッシュ + Smart Placement）](./phase10-1-edge-optimization.md)
- [10-2 境界防御・計測（WAF + Web Analytics）](./phase10-2-waf-analytics.md)
- [10-3 画像最適化（Cloudflare Images）](./phase10-3-image-optimization.md)

### Phase 9: Cloudflare Access（admin 領域限定）（計画済）

`admin`/`dashboard` を Cloudflare Access で先行保護。[詳細](./phase9-cloudflare-access-admin.md)。

### Phase 11: Workers AI (AI Search) RAG チャット（計画済・旧 Phase 6）

認証済みコンテンツページに会期スコープの RAG チャットを追加。セキュリティに Phase 6 を割り当てたため旧 Phase 6 から移動。[詳細](./phase11-rag-chat-modal.md)。

### Phase 7: パスキー（WebAuthn）（計画済）

メール+パスワードと併用するパスキー認証。[詳細](./phase7-passkey-webauthn.md)。

### Phase 8: Google OIDC ログイン（計画済）

Google を IdP とした OIDC ログイン併用。Phase 7 のマルチログイン基盤を前提とする。[詳細](./phase8-google-oidc-login.md)。

---

## 将来候補（タスク未作成）

導入検討レポートの Tier 4。必要性が出た段階でタスク化する。

- **Browser Rendering**: タイムテーブルの PDF 出力 / 動的 OG 画像生成
- **Queues**: 非同期処理（メール送信のリトライ・バッチ等。Phase 5 の運用次第で検討）
