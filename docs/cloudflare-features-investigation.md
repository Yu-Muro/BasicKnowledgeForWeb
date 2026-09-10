# Cloudflare 機能の導入検討（調査レポート）

作成日: 2026-06-30

本プロダクト（`reitaisai.info` / Bun モノレポ + Cloudflare Workers 2 アプリ）に対して、
追加導入を検討すべき Cloudflare 機能を調査・整理する。
仕様の正は実装コード（`apps/backend` / `apps/frontend` の `wrangler.jsonc` 等）とし、本書は検討メモである。

> 本レポートの推奨は **Phase 6（総当たり対策・最優先）** と **Phase 10（性能/UX/運用）** のタスクとして起票済み。
> （Phase 5 は別途「メール認証基盤」: [PR #167](https://github.com/RTS-souhon/BasicKnowledgeForWeb/pull/167)）
> 実行順は [タスク優先度ロードマップ](./tasks/roadmap.md) を参照。

---

## 1. 現状：すでに利用している Cloudflare 機能

| 機能 | 利用箇所 | 備考 |
|---|---|---|
| Workers | backend / frontend | backend=Hono、frontend=Next.js(OpenNext) |
| Hyperdrive | backend | CockroachDB(AWS ap-southeast-1) への接続プール |
| R2 | backend / frontend | 画像保存(`SHOP_ITEM_ASSET_BUCKET`) / Next.js ISR キャッシュ |
| D1 | frontend | OpenNext の Next.js タグキャッシュ(`NEXT_TAG_CACHE_D1`) |
| Service Bindings | frontend→backend | `BACKEND` バインディング |
| Workers Secrets | 両アプリ | `JWT_SECRET` |
| Observability(traces/logs) | 両アプリ | `wrangler.jsonc` で有効化済み |
| Custom Domain / Routes / DNS | ゾーン `reitaisai.info` | prod/dev でルート設定済み |

→ ストレージ・DB・配信の土台は概ね Cloudflare に乗っている。**未活用なのは「エッジ最適化」「セキュリティ（境界防御）」「画像最適化」「計測」の各領域**。

## 2. すでに「計画済み」の Cloudflare 機能（未実装）

`docs/tasks/` に計画ドキュメントが存在し、Cloudflare 機能として妥当。本レポートでは新規発見扱いせず、**実装推進を推奨**するに留める。

- **Phase 5（[PR #167](https://github.com/RTS-souhon/BasicKnowledgeForWeb/pull/167)・実装中）** — **Email Workers + Service Bindings** によるメール認証基盤（メール検証 / OTP ログイン / 信頼デバイス）。`apps/email-worker` を分離。
- `phase11-rag-chat-modal.md`（旧 phase6） — **Workers AI / AI Search (`ai_search` バインディング)** による会期スコープ RAG チャット。
- `phase9-cloudflare-access-admin.md` — **Cloudflare Access (Zero Trust)** を `admin`/`dashboard` に限定先行導入。

（`phase7` Passkey/WebAuthn, `phase8` Google OIDC は Cloudflare 固有機能ではないため対象外）

---

## 3. 新規推奨機能（優先度順）

### Tier 1 — 低工数・即効（最優先）

#### 3.1 Workers Rate Limiting バインディング（`ratelimit`）
- **何**: Worker 内でキー単位のレート制限ができる公式バインディング。2025-09 に GA。
- **なぜ本プロダクトに**: `POST /api/access-codes/verify` は「誰でも可」（`accessCodeRoutes.ts:40`）でアクセスコードの**総当たり**が可能。`POST /api/auth/login` も同様にブルートフォース対象。現状レート制限は皆無。
- **導入**: `wrangler.jsonc` に `ratelimits`（複数形）バインディング（namespace + `simple: { limit, period }`）を追加し、verify/login コントローラ先頭で **actor 単位のキー**（`CF-Connecting-IP` + ルート識別子）で `limiter.limit({ key })` を評価、超過時 429。**入力コードはキーに含めない**（含めると値を変えるたびカウンタが分散し列挙を素通しする）。単一コード/アカウントへの分散試行には第2リミッタを任意で追加。詳細は [Phase 6](./tasks/phase6-rate-limit-turnstile.md) を正とする。
- **コスト/工数**: 無料・Workers 標準。実装は小（ミドルウェア 1 つ + テスト）。
- **注意**: カウンタはデータセンター単位（厳密なグローバル一貫性はない）。総当たり抑止には十分。

#### 3.2 Hyperdrive クエリキャッシュの確認・チューニング
- **何**: Hyperdrive は読み取りクエリ結果をエッジでキャッシュ（既定 ON、2024-12 から全ロケーションでキャッシュ）。
- **なぜ本プロダクトに**: timetable / rooms / programs / shop_items / other_items の GET は**読み取り中心・更新頻度低**。キャッシュ最適化で DB 往復を削減できる。
- **導入**: Hyperdrive 設定でキャッシュが有効か確認し、`max_age` / `stale_while_revalidate` を内容更新頻度に合わせて調整。
- **コスト/工数**: 設定のみ・無料。
- **注意**: `NOW()` / `CURRENT_TIMESTAMP` 等の **STABLE/VOLATILE 関数を含むクエリはキャッシュ対象外**（2026-02 仕様）。期間判定はアプリ側で値を算出しパラメータ渡しにするとキャッシュが効く。

#### 3.3 Smart Placement / Placement Hints
- **何**: Worker を「バックエンド資源に近いロケーション」で実行させる。`placement.mode: "smart"`、または明示 `placement.region: "aws:ap-southeast-1"`（2026-01 追加）。
- **なぜ本プロダクトに**: backend は AWS ap-southeast-1 の CockroachDB へアクセス。1 リクエストで**複数回 DB 往復**する処理（search 等）でレイテンシ改善が見込める。
- **導入**: backend `wrangler.jsonc` に `placement` を追加するのみ。
- **コスト/工数**: 無料・設定のみ。
- **注意**: Hyperdrive が接続確立は近接処理済みのため効果は処理依存。まず dev で計測し、効果が出るルートで採用。

### Tier 2 — セキュリティ / UX 向上（中工数）

#### 3.4 Turnstile（CAPTCHA）
- **何**: プライバシー配慮のボット対策ウィジェット（reCAPTCHA 代替、無料・無制限）。
- **なぜ本プロダクトに**: `/access`（コード入力）/ `/login` / `/register` フォームのボット・総当たりを抑止。3.1 のレート制限と多層防御になる。
- **導入**: フロントにウィジェット設置 → `cf-turnstile-response` を backend へ送付 → siteverify で検証。共有 Zod スキーマに項目追加で型安全に。
- **コスト/工数**: 無料。フロント+バック小改修+テスト。

#### 3.5 Cloudflare Images（Transformations）
- **何**: 画像のリサイズ・WebP/AVIF 変換・最適化。R2 等「外部保存の画像」変換は **Free プランで月 5,000 ユニーク変換まで無料**（`cf.image` の fetch / URL インターフェース。※バインディング版は Paid プラン）。
- **なぜ本プロダクトに**: 現状 R2 画像は `/assets/*`（`index.ts:32`）で**無加工配信**、フロントは `next/image` を `unoptimized` で使用（`TapToZoomImage`）。shop/programs/others は画像多め。**会場のモバイル回線**でサムネ＋WebP/AVIF 配信は体験改善が大きい。
- **導入（無料枠で）**: backend `/assets/*` を `fetch(originalR2Url, { cf: { image: { width, format } } })` 経由に変更（`format` は `Accept` ヘッダーで avif/webp を選択。Worker では `format: 'auto'` は自動ネゴシエートしない）、もしくはフロントで変換 URL を組み立て。`width` プリセット（thumbnail/large）で配信。
- **コスト/工数**: Free 枠で開始可。小〜中改修。
- **注意**: 月 5,000 ユニーク変換超で `9422`。Worker 内でレスポンスを検査し原画像へフォールバック（`onerror=redirect` は URL インターフェース専用）。規模拡大時は Paid 検討。

#### 3.6 Cloudflare Web Analytics
- **何**: クッキーレス・プライバシー配慮のアクセス解析（無料）。
- **なぜ本プロダクトに**: 会期中の来場者アクセス傾向（人気ページ・ピーク時間帯）を計測でき、運用判断に有用。Core Web Vitals も取得。
- **導入**: ダッシュボードでサイト追加 → frontend にビーコン。サーバー側設定不要。
- **コスト/工数**: 無料・極小。

### Tier 3 — ゾーンレベル境界防御（運用設定中心）

#### 3.7 WAF（Managed Rules / Rate limiting rules / Bot Fight Mode）
- **何**: ゾーン `reitaisai.info` に対するダッシュボード設定の防御群。「Protect your login」ワンクリックルール（5 分で 5 POST 超を 15 分ブロック）も利用可。
- **なぜ本プロダクトに**: アプリ実装に依存しない**第 0 層**の防御。3.1/3.4 と補完関係。
- **コスト/工数**: 設定のみ（プラン依存機能あり）。

### Tier 4 — 将来・任意

- **Browser Rendering**: タイムテーブルの **PDF 出力**や動的 **OG 画像**生成に活用可（会期パンフ代替・SNS シェア映え）。
- **Queues + Email Routing/Workers**: 通知メール・非同期処理が必要になった場合の選択肢。
- **（計画済再掲）Workers AI / AI Search RAG（phase11）, Cloudflare Access（phase9）**: 実装推進を推奨。

---

## 4. 優先度まとめ

| # | 機能 | 効果 | 工数 | コスト | 推奨度 |
|---|---|---|---|---|---|
| 3.1 | Workers Rate Limiting | セキュリティ↑↑ | 小 | 無料 | ★★★ |
| 3.2 | Hyperdrive キャッシュ調整 | 性能↑ | 極小 | 無料 | ★★★ |
| 3.3 | Smart Placement | 性能↑ | 極小 | 無料 | ★★☆ |
| 3.4 | Turnstile | セキュリティ↑ | 中 | 無料 | ★★★ |
| 3.5 | Images 変換 | UX↑(モバイル) | 中 | 無料枠 | ★★☆ |
| 3.6 | Web Analytics | 運用可視化 | 極小 | 無料 | ★★☆ |
| 3.7 | WAF ルール | セキュリティ↑ | 小(設定) | プラン依存 | ★★☆ |

## 5. 推奨ロードマップ

1. **まず設定だけで効く 3 つ**: Hyperdrive キャッシュ確認(3.2) → Smart Placement(3.3) → Web Analytics(3.6)。コード変更小、効果計測の基盤になる。
2. **セキュリティ多層化**: Rate Limiting(3.1) → Turnstile(3.4) → WAF ルール(3.7)。アクセスコード総当たり耐性を底上げ。
3. **体験改善**: Images 変換(3.5) を shop/others 等の画像配信に適用。
4. **計画済みの推進**: phase11(AI Search RAG) / phase9(Cloudflare Access)。

> ↑ 上記はタスクに落とし込み済み（セキュリティは最優先で **Phase 6**、性能/UX/運用は **Phase 10**）。最新の優先順位は [tasks/roadmap.md](./tasks/roadmap.md) を正とする。
> - [Phase 6 総当たり対策（Rate Limiting + Turnstile）](./tasks/phase6-rate-limit-turnstile.md) … 3.1 + 3.4
> - [Phase 10-1 エッジ最適化（Hyperdrive キャッシュ + Smart Placement）](./tasks/phase10-1-edge-optimization.md) … 3.2 + 3.3
> - [Phase 10-2 境界防御・計測（WAF + Web Analytics）](./tasks/phase10-2-waf-analytics.md) … 3.7 + 3.6
> - [Phase 10-3 画像最適化（Cloudflare Images）](./tasks/phase10-3-image-optimization.md) … 3.5

## 6. 対象外・見送り

- **D1 への DB 移行**: 既に CockroachDB+Hyperdrive で確立。移行価値なし。
- **KV / Durable Objects**: 現状の要件（リアルタイム協調・分散ロック等）が薄く、過剰。将来の機能次第。
- **Stream / Load Balancing / Magic Transit**: 規模・要件に不適合。
