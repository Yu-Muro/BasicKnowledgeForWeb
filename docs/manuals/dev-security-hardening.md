# Dev環境の探索遮断・認証API試行回数制限

## 適用範囲

2026-10-05に着手した第1段階。WAFは `dev.reitaisai.info` と
`assets.dev.reitaisai.info` のみ、アプリの制限は backend の `env.dev` のみで有効にする。
prodには制限バインディングと有効化変数を追加していない。

## WAF

Cloudflareのセキュリティルールで以下のカスタムルールを作成した。

- 名前: `Dev - Block automated secret and PHP probes`
- ID: `11cd21676ddb467eb513cd75ab51f1f2`
- アクション: Block / ステータス: アクティブ / 順序: 最後
- 本番とdevは同一ゾーンなので、ホスト名条件を削除しない。

```text
(http.host in {"dev.reitaisai.info" "assets.dev.reitaisai.info"} and (lower(http.request.uri.path) contains "/.env" or lower(http.request.uri.path) contains "/.git" or lower(http.request.uri.path) contains "/.aws/" or lower(http.request.uri.path) contains "/wp-" or lower(http.request.uri.path) contains ".php"))
```

正常なAPI、画像、`/cdn-cgi/rum` はこのパス条件に一致しない。
秘密ファイル名・PHPファイル名を画像キーとして使用するケースも遮断されるため、
そのような資産を新たに公開する際はルールを見直す。
URLエンコード・正規化による変種の網羅は後続の検証対象。
ルールはダッシュボード設定であり、Workerのデプロイでは作成・更新されない。

## 認証APIの回数制限

対象はPOSTの以下3経路。DB生成・入力検証の前にカウントする。

- `/api/auth/login`: `login:<CF-Connecting-IP>`
- `/api/access-codes/verify`: `verify:<CF-Connecting-IP>`
- `/api/users`: `register:<CF-Connecting-IP>`

Devの `PUBLIC_AUTH_RATE_LIMITER` は60秒で60回、namespaceは `1003`。
操作ごとに別カウンタ。メールやコードなどの入力値はキーに含めない。
上限超過で429、`Retry-After: 60` と `Cache-Control: no-store` を返す。
有効化中にbinding/IPがない、またはリミッタが障害の場合は503で止める。
`X-Forwarded-For` などの代替ヘッダーは信用しない。
ブラウザの3フォームは公開APIへ直接リクエストする。
今後Server Actions経由にする際は、信頼できる送信元情報の扱いを再設計する。

CloudflareのWorkers Rate Limitingは拠点単位の近似制限であり、
分散攻撃に対する厳密な全世界合算の回数保証ではない。
IP共有による誤制限の影響をDevで評価し、本番の閾値を決める。

## Devへの反映記録

- backend Worker: `basic-knowledge-for-web-backend-dev`
- 反映日: 2026-10-05
- Version ID: `d7bec1e5-7a3b-435f-8db9-9096b0fecc49`
- 設定のdry-runでDev専用bindingと有効化変数を確認してから反映。
- 本番のWorker・WAF対象ホストは変更していない。

## 検証

- backendの型チェック・lint・全テストを実施。
- frontendの型チェックでHonoクライアントとの契約を確認。
- Devで `.env`・PHP探索が403、正常なAPIの入力不備が400になること。
- 空JSONのPOSTで回数制限を検証する（入力検証で止まり、ユーザーを作成しない）。
- 429の `Retry-After` と、期間経過後の復帰を確認する。
- login/access/register、管理画面、画像、RUMの正常利用をDevで確認してから本番展開する。

## ロールバック

- WAF: 上記のDev専用ルールを無効化する。既存ルールは変更しない。
- API: `env.dev.vars.PUBLIC_AUTH_RATE_LIMIT_ENABLED` を `"false"` にし、
  backendを `bun run deploy:dev` で再デプロイする。
- Devで確認した版と本番昇格版をPRに記録する。本番へ直接デプロイしない。

## 後続作業

- TurnstileをDev専用ウィジェット・secretで導入し、login/access/registerの
  サーバー側検証とUIを揃える（backend→テスト→frontend→テストの順）。
- 認証成功率、429/503、WAF一致件数、Worker到達数で効果と誤検知を評価する。
- FreeのWAFレート制限はホスト条件が使えずゾーン内のDev/Prodを分離できないため、
  今回は設定しない。詳細: https://developers.cloudflare.com/waf/rate-limiting-rules/#availability
- Workers制限の特性: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
