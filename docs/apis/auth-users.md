# 認証・ユーザーAPIの補足

型・必須条件・HTTP応答の正本は [openapi.yaml](openapi.yaml)の `Auth` / `Users`です。[API案内](README.md)へ戻る。

| 操作 | operationId |
|---|---|
| ログイン / ログアウト | `login` / `logout` |
| ログイン情報 / パスワード変更 | `getCurrentUser` / `changePassword` |
| ユーザー一覧 / 登録 / ロール変更 | `getUsers` / `createUser` / `updateUserRole` |

`auth_token`はCookieで送信します。ログインのJWTとCookieの有効期限は7日です。`me`はJWT payloadを返し、DBの再取得はしません。ログアウトはauth_tokenのみを削除します。

一覧とロール変更はadminが必要です。現行の公開登録ではroleは任意の文字列で、更新APIのuser/admin enumとは異なります。登録レスポンスにはbcryptのpasswordハッシュがあり、一覧はこのフィールドを除去します。これらは現行コードの記録で、推奨する新規設計ではありません。

実装: `authRoutes.ts` / `userRoutes.ts`、対応controller・validator、`use-cases/auth/`・`use-cases/user/`・`infrastructure/repositories/user/`。将来のメール認証は [Phase 5](../tasks/phase5-email-auth-with-email-worker.md)を参照してください。
