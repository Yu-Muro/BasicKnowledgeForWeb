# Phase 10-2: 境界防御・計測（WAF ルール + Web Analytics）

## 対象

- Cloudflare ダッシュボード（ゾーン `reitaisai.info`）
- `apps/frontend`（Web Analytics ビーコン。自動注入できない場合のみ）
- `docs/implementation-plan.md` / `docs/manuals`（運用手順の追記）

## 目的

アプリ実装に依存しない **第 0 層の境界防御**（WAF）と、会期中のアクセス可視化（Web Analytics）を
ダッシュボード設定中心で導入する。[Phase 6（総当たり対策）](./phase6-rate-limit-turnstile.md) のアプリ側対策と多層防御を成す。

## 実装順序

1. dev/ステージングで WAF ルールを設定・検証
2. Web Analytics を有効化
3. prod へ反映
4. 運用手順を明文化

## 実装内容

### A. WAF

1. **Rate limiting rule** を作成し、`/api/access-codes/verify` と `/api/auth/login` に適用する。
   - **検証中は `dev.reitaisai.info` のホスト名条件を必ず付ける。** dev と prod は同一ゾーンのため、
     パスのみの条件だと prod にも即適用され、実ユーザーを誤ブロックしうる。dev で検証後に
     `reitaisai.info` 用へ昇格/複製する。
   - 「Protect your login」テンプレート（5 分で 5 POST 超過時に 15 分ブロック）を起点に、運用に合わせて調整する。
2. **Managed Rules** / **Bot Fight Mode** をプラン範囲で有効化する。
3. 誤検知・例外を監視し、必要に応じてスキップルールを追加する。

### B. Cloudflare Web Analytics

4. ダッシュボードでサイトを追加し、ビーコンを有効化する（プロキシ配下のため自動注入が可能。不可の場合のみ frontend に手動設置）。
5. 人気ページ・ピーク時間帯・Core Web Vitals を確認できる状態にする。

## このフェーズでやらないこと

- アプリ側のレート制限（[Phase 6](./phase6-rate-limit-turnstile.md) で実施）
- 有料 WAF 機能を前提とした設計
- 外部解析 SaaS の導入（Cloudflare Web Analytics に一本化）

## 注意・コスト

- 一部の WAF 機能（カスタムルール数・高度な Bot Management 等）は **プラン依存**。現行プランで利用可能な範囲から適用する。
- Cloudflare Web Analytics は **無料**。
- Workers の Observability（traces/logs）は既に有効化済みのため本タスクの対象外。

## テスト

- 主に手動検証（自動テスト対象外）。
- WAF: しきい値を超えるリクエストでルールが発火し、ブロック/チャレンジされること。正常利用が誤ブロックされないこと。
- Web Analytics: 実アクセスがダッシュボードに記録されること。
- dev/ステージングで検証後に prod へ反映する。

## 完了条件

- login/verify 系に WAF レート制限ルールが適用されている（検証は dev ホスト名限定 → prod へ昇格の順）
- Web Analytics の計測が開始されている
- WAF の誤検知時のロールバック手順が明文化されている
