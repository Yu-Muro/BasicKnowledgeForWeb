# Better Authへの認証移行

## 対象と構成

既存のメールアドレス・パスワード認証をBetter AuthのDBセッションへ移行する。メール認証・OTP・パスキー・Googleログインは対象外。`email_verified` は追加するが、確認メールは送信しない。

既存の `/api/auth/login`・`logout`・`me`・`password` と `/api/users` の契約を維持し、Better Authの汎用ルートは公開しない。登録は既存の部署・ロール制約を通したうえで、ユーザーとcredentialアカウントを同一トランザクションで作成する。Better Authのサインアップは無効。

- ユーザーUUIDとbcryptハッシュ（12 rounds）を維持し、既存アカウントのパスワード再設定は不要。
- `auth_accounts`・`auth_sessions`・`auth_verifications`・`auth_rate_limits` を追加する。
- `auth_token` は署名付きセッションCookieとなり、旧JWTは拒否する。導入後は再ログインが必要。
- 有効期限は7日、自動延長・Cookieキャッシュは無効。HTTPSではSecure、常にHttpOnlyとSameSite=Laxを付与する。
- ログアウトは現在のDBセッション、パスワード変更は全端末のセッションを失効させる。
- `/api/auth/me` とBackendミドルウェアで現在のユーザー・所属・権限・削除状態を検証する。FrontendはユーザーCookieをデコードしない。
- 会期閲覧用 `access_token` は従来のJWTを維持し、ユーザーセッションから独立して検証する。
- ログインにDBによる試行制限を適用し、更新系APIのOriginを検証する。

移行中の互換性のため `users.password` と `auth_accounts.password` を併存させ、更新を同一トランザクションで反映する。旧Workerによる書き込みはログイン時にも同期する。`users.password` の空文字デフォルトはBetter Authのスキーマ検証への対応であり、パスワードなしの公開登録は提供しない。

## 導入前の確認

この変更は部署統合ブランチを起点としている。先に部署統合PR #472を取り込み、部署統合の段階移行を完了すること。認証migrationは部署統合の契約変更migrationより後にあるため、互換拡張だけでは認証テーブルまで到達しない。

メールアドレスを小文字へ正規化する。次のSQLで削除済みを含めた大文字・小文字の衝突を確認する。結果がある場合は所有者を確認して解消する。アカウントの自動統合は行わず、衝突時はmigrationが失敗する。

```sql
SELECT lower(email), count(*) FROM users
GROUP BY lower(email) HAVING count(*) > 1;
```

dev/prodそれぞれのGitHub Environmentに `BETTER_AUTH_SECRET` を登録する。32文字以上のランダムな値を使い、環境間で共有しない。デプロイワークフローがBackend Workerのsecretへ反映する。ローカルではBackendの `.dev.vars` に設定する。秘密値はコミットしない。

`BETTER_AUTH_URL` はBackendのWrangler設定でローカル・dev・prodの公開URLを設定済み。`JWT_SECRET` は会期JWT用としてBackend/Frontendに残す。Frontendに `BETTER_AUTH_SECRET` は不要。

## デプロイ順序

1. 部署統合が完了したDBへ認証migrationを適用し、credentialアカウントをバックフィルする。
2. Hyperdriveのクエリキャッシュを無効化する。
3. Backendをデプロイし、新しいsecretを設定する。
4. 既存のデプロイフローの移行確認後、Frontendをデプロイする。
5. 既存ユーザーでログイン、パスワード変更後の再ログイン、ログアウト後の旧Cookie拒否を確認する。

dev/prodのデプロイワークフローに `hyperdrive update ... --caching-disabled` を追加している。`CLOUDFLARE_API_TOKEN` に対象Hyperdriveの編集権限が必要。キャッシュによって失効済みセッションや古い権限が読まれることを防ぐため、認証以外のDB読み取りも含めて無効化する。DB負荷の変化を導入後に確認する。

このPRの実装・検証ではクラウドへのデプロイ、実環境のDB移行、Hyperdrive設定変更を行っていない。

## 検証

通常のBackend/Frontendの型検査・lint・Jestに加え、専用CockroachDBへ全migrationを適用し、実際のBetter Authで検証する。

```bash
cd apps/backend
AUTH_TEST_DATABASE_URL=postgresql://root@localhost:26257/better_auth_core_test?sslmode=disable bun run test:auth:integration
```

必ず専用の移行済みテストDBを指定する。このスクリプトは `.env` を読み込まず、テストユーザーとレート制限データを削除する。既存のアプリDBを指定しない。CIのmigration検証ジョブでも実行する。

検証対象は既存bcryptアカウント（旧版が登録した大文字メールを含む）、登録、Secure属性、期限切れ、ログアウト、パスワード変更による全セッション失効、降格・所属変更・論理削除、旧JWT拒否、不正Origin、レート制限、会期JWTの独立性。ローカルのWorkersランタイムでも一連の認証APIを確認する。

Better AuthとDrizzle adapterは1.7.7で固定する。現行Drizzle `1.0.0-beta.21` はadapterが宣言するpeer dependencyの範囲外だが、CockroachDBとローカルWorkersでの実動作を検証している。依存更新時も統合テストを維持する。実環境のHyperdrive経由での動作確認はデプロイ後に必要。

## ロールバック

BackendとFrontendを揃えて戻し、再ログインを案内する。Better AuthのCookieは旧BackendのJWT検証を通らない。互換性を維持した `users.password` を旧版が利用できるため、パスワードの復元は不要。

追加テーブル・列は削除しない。migration履歴やスナップショットを巻き戻さない。JWT方式へ戻しても、以前のJWTが有効期間内なら再び通る可能性があるため、必要に応じて旧認証の鍵運用を確認する。会期JWTの鍵変更は閲覧用トークンにも影響する。

既存の将来機能計画（メール認証・OTP等）は引き続き未実装。着手時にBetter Auth前提で設計を見直す。

## 参考

- [Better Auth Hono連携](https://www.better-auth.com/docs/integrations/hono)
- [Better Auth Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [Better Authセッション管理](https://www.better-auth.com/docs/concepts/session-management)
- [Cloudflare Hyperdriveキャッシュ](https://developers.cloudflare.com/hyperdrive/configuration/query-caching/)
