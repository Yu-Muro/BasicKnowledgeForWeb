# Phase 10 タスク一覧（Cloudflare 基盤強化：性能・UX・運用）

Phase 10 は Cloudflare 機能で「性能・UX・運用」を底上げする低工数・高レバレッジ群です。

> セキュリティの総当たり対策は緊急度が高いため、[Phase 6（Rate Limiting + Turnstile）](./phase6-rate-limit-turnstile.md) として分離・昇格しています。

優先順位の全体像は [タスク優先度ロードマップ](./roadmap.md)、調査根拠は [Cloudflare 機能の導入検討レポート](../cloudflare-features-investigation.md) を参照してください。

## このフェーズで実装するもの

- Hyperdrive クエリキャッシュの最適化 + Smart Placement（DB 近傍実行）
- WAF ルール（境界防御）と Cloudflare Web Analytics（計測）
- Cloudflare Images Transformations による画像最適化

## このフェーズで実装しないもの

- アクセスコード/ログインの総当たり対策（[Phase 6](./phase6-rate-limit-turnstile.md) で実施）
- メール認証基盤（Phase 5 / [PR #167](https://github.com/RTS-souhon/BasicKnowledgeForWeb/pull/167)）
- 新規プロダクト機能・認証方式追加・Cloudflare Access（Phase 7 / 8 / 9 / 11）
- CockroachDB から他 DB への移行

## 実装順序（優先度順）

各タスクは **backend → backend test → frontend → frontend test** の順を厳守します。
設定中心のタスクは dev で検証してから prod へ反映します。

1. [Phase 10-1 エッジ最適化（Hyperdrive キャッシュ + Smart Placement）](./phase10-1-edge-optimization.md)
2. [Phase 10-2 境界防御・計測（WAF ルール + Web Analytics）](./phase10-2-waf-analytics.md)
3. [Phase 10-3 画像最適化（Cloudflare Images）](./phase10-3-image-optimization.md)
