# 会期・アクセスコードAPIの補足

契約の正本は [openapi.yaml](openapi.yaml)の `AccessCodes`です。[API案内](README.md)へ戻る。

| 操作 | operationId |
|---|---|
| アクセスコード確認 | `verifyAccessCode` |
| 管理用一覧 / 作成 | `getAccessCodes` / `createAccessCode` |
| 会期詳細 / 削除 | `getAccessCode` / `deleteAccessCode` |

確認APIは有効期間内のcodeを受け付け、JWTのexpをvalidToに設定します。access_token CookieはHttpOnly・Secure・SameSite=Laxで、Max-Age/Expiresのないsession Cookieです。

会期詳細はaccess_tokenのevent_idとx-event-idの一致、またはauth_token(admin)で閲覧します。このルートはadminならヘッダー省略可で、ヘッダーのUUID形式とパスIDの一致を検証しません。以前の「必須ヘッダー」説明とは区別します。

管理用一覧・作成・削除はadmin専用です。validToはvalidFromより後、一覧はvalidFrom降順。削除が参照制約等で失敗した場合は現行実装では500です。

実装: `accessCodeRoutes.ts`、`accessCodeController.ts`、`accessCodeValidator.ts`、`use-cases/access-code/`。
