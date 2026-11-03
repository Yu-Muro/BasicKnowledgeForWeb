# 認証・ユーザーAPIの補足

型・必須条件・HTTP応答の正本は [openapi.yaml](openapi.yaml)の `Auth` / `Users`です。[API案内](README.md)へ戻る。

| 操作 | operationId |
|---|---|
| ログイン / ログアウト | `login` / `logout` |
| ログイン情報 / パスワード変更 | `getCurrentUser` / `changePassword` |
| ユーザー一覧 / 登録 / ロール変更 | `getUsers` / `createUser` / `updateUserRole` |

`auth_token`はCookieで送信します。ログインのJWTとCookieの有効期限は7日です。`me`を含む認証APIはDBの現在のロール・部署・削除状態・セッション世代を確認します。ログアウトはauth_tokenのみを削除します。

一覧・ロール変更・所属変更・削除・復元はadmin専用です。公開登録はuserのみ、有効な部署が必須です。削除は所属も解除する論理削除で、メールは再利用できません。管理者が元のアカウントを復元するとセッション世代が進み、本人は従来のパスワードで再ログインします。登録を含めpasswordは返さず、一覧・復元はsessionVersionも返しません。既存の一般ユーザーは管理者が部署を指定するまで認証できません。

公開の `/login`・`/access` は古いCookieの確認が403/503でも利用できます。有効な会期トークンによる閲覧は独立しています。会期トークンのないコンテンツ画面は、アカウント確認が403なら `/access` へ誘導し、503なら再試行を案内します。管理画面の403は管理者への確認を案内します。

実装: `authRoutes.ts` / `userRoutes.ts`、対応controller・validator、`use-cases/auth/`・`use-cases/user/`・`infrastructure/repositories/user/`。将来のメール認証は [Phase 5](../tasks/phase5-email-auth-with-email-worker.md)を参照してください。
