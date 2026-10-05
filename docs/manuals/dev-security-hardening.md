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

- `/api/auth/login`: `login:<送信元キー>`
- `/api/access-codes/verify`: `verify:<送信元キー>`
- `/api/users`: `register:<送信元キー>`

Devの `PUBLIC_AUTH_RATE_LIMITER` は60秒で60回、namespaceは `1003`。
送信元キーはIPv4ではそのまま、IPv6では表記を正規化した/64プレフィックス。
同一/64内でアドレスを切り替えてもカウンタを共有する。/64間の分散攻撃は別途対策する。
操作ごとに別カウンタ。メールやコードなどの入力値はキーに含めない。
上限超過で429、`Retry-After: 60` と `Cache-Control: no-store` を返す。
有効化中にbinding/IPがない、またはリミッタが障害の場合は503で止める。
`X-Forwarded-For` などの代替ヘッダーは信用しない。不正なIPも503で拒否する。
503時は `public_auth_rate_limit_unavailable` に操作と理由
（missing-binding / missing-ip / invalid-ip / limiter-error）だけを記録し、
IP・入力・例外詳細は含めない。
ブラウザの3フォームは公開APIへ直接リクエストする。
今後Server Actions経由にする際は、信頼できる送信元情報の扱いを再設計する。

CloudflareのWorkers Rate Limitingは拠点単位の近似制限であり、
分散攻撃に対する厳密な全世界合算の回数保証ではない。
IP・IPv6プレフィックス共有による誤制限の影響をDevで評価し、本番の閾値を決める。
本番ではDevの `1003` と異なるnamespace_idを割り当てる。
同一namespaceはWorker間でカウンタを共有するため、設定をそのまま複製しない。

## Devへの反映記録

- backend Worker: `basic-knowledge-for-web-backend-dev`
- 反映日: 2026-10-05
- Version ID: `d7bec1e5-7a3b-435f-8db9-9096b0fecc49`
- 設定のdry-runでDev専用bindingと有効化変数を確認してから反映。
- 本番のWorker・WAF対象ホストは変更していない。
- 上記Versionは初回の手動反映時点の記録であり、現在の反映版を保証しない。
  PRマージ前のdevelopへのpush（Renovate自動マージを含む）はCIで制限なしの版を
  再デプロイするため、実環境のVersion・binding・有効化変数を再確認する。
  恒久反映はこのPRをdevelopへマージし、deploy-dev.ymlの成功を確認する。

## 検証

### 初回版で実施済み（2026-10-05）

- backend 38 suites / 377 tests、型チェック、lint成功。frontend型チェック成功。
- Devで `.env`・PHP探索は403、healthは200、空JSONの認証APIは400。
- 空JSONの80回連続POSTで400が61回、429が19回。入力検証で停止しユーザーは作成しない。
- 時間経過後に400へ復帰。429のヘッダーは自動テストで検証。
- 短時間の並列要求では429が出なかったため、厳密な回数保証として扱わない。

### レビュー修正版で実施済み（2026-10-06）

- backend 39 suites / 398 tests、型チェック、lint成功。frontend型チェック成功。
- IPv6の同一/64・表記揺れ・別/64、異常IP、503の理由ログ、設定期間の整合性を自動検証。
- Dev dry-run後に反映。Version: `179a2752-ea0c-449d-bee3-78e52b80da53`。
- Devのhealth 200、空JSONのlogin 400を確認。IPv6実接続による制限確認は未実施。

### 本番展開前に実施

- [ ] レビュー修正版のDev反映Version・設定とIPv6 /64単位の制限を確認。
- [ ] 実環境の429ヘッダーを確認。
- [ ] login/access/register、管理画面、画像、RUMの正常利用を一通り確認。
- [ ] IP・IPv6プレフィックス共有時の誤制限を評価。

## ロールバック

- WAF: 上記のDev専用ルールを無効化する。既存ルールは変更しない。
- API: `env.dev.vars.PUBLIC_AUTH_RATE_LIMIT_ENABLED` を `"false"` にし、
  backendを `bun run deploy:dev` で再デプロイする。
- 緊急の手動無効化と同時に、developの同変数を `"false"` にするPRを作成し、
  マージ後のCIデプロイ成功を確認する。マージ前は次のCIで再有効化されるので、
  手動変更だけを恒久ロールバックとして扱わない。
- Devで確認した版と本番昇格版をPRに記録する。本番へ直接デプロイしない。

## 後続作業

- TurnstileをDev専用ウィジェット・secretで導入し、login/access/registerの
  サーバー側検証とUIを揃える（backend→テスト→frontend→テストの順）。
- 認証成功率、429/503、WAF一致件数、Worker到達数で効果と誤検知を評価する。
- FreeのWAFレート制限はホスト条件が使えずゾーン内のDev/Prodを分離できないため、
  今回は設定しない。詳細: https://developers.cloudflare.com/waf/rate-limiting-rules/#availability
- Workers制限の特性: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
