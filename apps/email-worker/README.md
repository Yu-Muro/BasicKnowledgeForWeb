# Email Worker

Cloudflare Email Service の Email Sending binding を扱う専用 Worker です。
Backend Worker から Service Binding で呼び出すため、実行時の API Token は
使用しません。

## Cloudflare prerequisites

- 任意のユーザー宛に送信するため、Cloudflare Workers Paid plan を使用する
- Email Sending で `reitaisai.info` を送信ドメインとして有効化する
- dev の送信元を分ける場合は `dev.reitaisai.info` も個別に有効化する
- `cf-bounce` MX、SPF、DKIM、DMARC の状態を Dashboard で確認する

Email Routing だけを有効にした状態では、送信先は検証済み Destination Address
に限定されます。登録確認・OTP の送信には Email Sending のドメイン設定が必要です。

## Scripts

```bash
bun run dev
bun run build
bun run cf-typegen
bun run lint
bun run type-check
bun run test
```

## Internal API

- `POST /internal/email/send`
- 認可: Cloudflare Service Binding (`EMAIL_WORKER`) 経由のみ

## Worker Visibility

```bash
workers_dev = false
```

公開 URL を持たない Worker としてデプロイし、backend Worker からの service binding 呼び出し専用で利用します。

### Request body

```json
{
  "to": "user@example.com",
  "template": "email_verification",
  "code": "123456"
}
```

`template` は `email_verification` または `login_otp` を受け付けます。

## Delivery failures

Email Sending がエラーを返した場合は、宛先やコードをログへ出さずにエラーコードと
テンプレート種別だけを記録し、Backend へ `502` を返します。Email Worker 内では
自動再試行せず、重複送信を避けるため Backend 側で再試行可否を判断します。

## Binding types

`worker-configuration.d.ts` は `wrangler.jsonc` から生成します。binding または
compatibility date を変更した場合は `bun run cf-typegen` を実行してください。
`bun run type-check` は生成済みファイルとの差分も検証します。
