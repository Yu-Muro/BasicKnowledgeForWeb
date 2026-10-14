# API仕様（OpenAPI 3.2.1）

HTTP APIの型・パラメーター・認証・レスポンスは、以下のOpenAPI文書にまとめています。実装との相違が見つかった場合はコードを確認して文書を更新します。

| 文書 | 対象 |
|---|---|
| [openapi.yaml](openapi.yaml) | Backendの42 API操作とローカル画像配信1操作 |
| [email-worker.openapi.yaml](email-worker.openapi.yaml) | Service Binding経由の内部メール送信1操作 |

規格は [OpenAPI Specification 3.2.1](https://spec.openapis.org/oas/v3.2.1.html)に固定しています。[latest](https://spec.openapis.org/oas/latest.html)の更新で、この文書の規格版を自動変更しません。Schema ObjectはJSON Schema Draft 2020-12を明示しています。

[ドキュメント案内](../README.md)へ戻る。未実装のメール検証・OTP・信頼デバイスは [Phase 5計画](../tasks/phase5-email-auth-with-email-worker.md)に分けています。

## 読み方と利用範囲

- `servers`はBackendのprod/dev/ローカルのベースURL。`paths`は `/api`を含む完全なパスです。
- `components/schemas`に入力とレスポンスの型、`parameters`に会期ヘッダーとパスID、`responses`に共通エラーを定義しています。
- Cookieは `apiKey` + `in: cookie`で記述しています。JWTでも送信場所はBearerヘッダーではありません。
- `security`の複数要素はOR、同じ要素内はANDです。`AuthCookie: [admin]`はアプリの必要ロールを表し、OAuth scopeではありません。
- 会期一致や日時比較、同一会期の部署、画像キーprefixはSchemaだけで表しきれないため、operation/入力schemaの説明も確認してください。
- 生のファイル/画像は3.2.1のバイナリ記述に沿って扱い、3.0向けの `format: binary` に依存しません。
- Email Workerには公開prod/dev URLを記載しません。`security: []`はHTTPトークンを検証しない実装を表し、公開アクセスを許可する配備方針ではありません。
- `/assets/{key}`はHonoの `/assets/*` の表現です。階層キーはcatch-allであり、通常のpath parameterだけではクライアント動作を保証できません。対象はローカルBackendの配信経路です。

## 現行実装で注意する違い

- `GET /api/access-codes/{id}`はadmin認証なら `x-event-id`省略可。access_token認証ではJWTとのヘッダー一致が必要ですが、パスIDとの一致は検証していません。
- `POST /api/users`はroleに任意の1〜50文字の文字列を受け付け、登録レスポンスにはpasswordのbcryptハッシュが含まれます。`GET /api/users`はpasswordを除去します。今回は現行仕様の記述のみ行い、これらの挙動は変更していません。
- 入力不正のHTTPステータスは処理経路で異なります。登録APIのJSON解析失敗は500、他のJSON入力APIの多くは400です。
- 画像アップロードはFileとしての入力を要求しますが、独自のMIME/サイズ制限や変換処理はありません。キー拡張子と実データ型の一致を保証する仕様にはしていません。

## 操作一覧

以下はOpenAPI文書から整理した案内です。正確な必須条件・エラー・本文・ヘッダーはYAMLの該当operationを参照してください。

| Method | Path | 認証 | 操作 |
|---|---|---|---|
| GET | `/api/health` | 不要 | DB疎通を含む稼働状態を取得 |
| POST | `/api/auth/login` | 不要 | ログインしてauth_tokenを発行 |
| POST | `/api/auth/logout` | 不要 | auth_tokenを削除 |
| GET | `/api/auth/me` | auth_token | ログイン中のユーザー情報を取得 |
| PUT | `/api/auth/password` | auth_token | パスワードを変更 |
| GET | `/api/users` | auth_token(admin) | ユーザー一覧を取得 |
| POST | `/api/users` | 不要 | ユーザーを登録 |
| PUT | `/api/users/{id}/role` | auth_token(admin) | ユーザーのロールを変更 |
| POST | `/api/access-codes/verify` | 不要 | アクセスコードを確認してaccess_tokenを発行 |
| GET | `/api/access-codes` | auth_token(admin) | 管理用の会期一覧を取得 |
| POST | `/api/access-codes` | auth_token(admin) | 会期とアクセスコードを作成 |
| GET | `/api/access-codes/{id}` | access_token + 会期一致 または auth_token(admin) | 会期詳細を取得 |
| DELETE | `/api/access-codes/{id}` | auth_token(admin) | 会期を削除 |
| GET | `/api/timetable` | access_token + 会期一致 または auth_token(admin) | 時間割一覧を取得 |
| POST | `/api/timetable` | auth_token(admin) | 時間割を作成 |
| PUT | `/api/timetable/{id}` | auth_token(admin) | 時間割を部分更新 |
| DELETE | `/api/timetable/{id}` | auth_token(admin) | 時間割を削除 |
| GET | `/api/rooms` | access_token + 会期一致 または auth_token(admin) | 部屋割り一覧を取得 |
| POST | `/api/rooms` | auth_token(admin) | 部屋割りを作成 |
| PUT | `/api/rooms/{id}` | auth_token(admin) | 部屋割りを部分更新 |
| DELETE | `/api/rooms/{id}` | auth_token(admin) | 部屋割りを削除 |
| GET | `/api/programs` | access_token + 会期一致 または auth_token(admin) | 企画一覧を取得 |
| POST | `/api/programs` | auth_token(admin) | 企画を作成 |
| PUT | `/api/programs/{id}` | auth_token(admin) | 企画を部分更新 |
| DELETE | `/api/programs/{id}` | auth_token(admin) | 企画を削除 |
| POST | `/api/programs/upload` | auth_token(admin) | 企画の画像をアップロード |
| GET | `/api/shop-items` | access_token + 会期一致 または auth_token(admin) | 販売物一覧を取得 |
| POST | `/api/shop-items` | auth_token(admin) | 販売物を作成 |
| PUT | `/api/shop-items/{id}` | auth_token(admin) | 販売物を部分更新 |
| DELETE | `/api/shop-items/{id}` | auth_token(admin) | 販売物を削除 |
| POST | `/api/shop-items/upload` | auth_token(admin) | 販売物の画像をアップロード |
| GET | `/api/departments` | access_token + 会期一致 または auth_token(admin) | 部署一覧を取得 |
| POST | `/api/departments` | auth_token(admin) | 部署を作成 |
| PUT | `/api/departments/{id}` | auth_token(admin) | 部署を部分更新 |
| DELETE | `/api/departments/{id}` | auth_token(admin) | 部署を削除 |
| GET | `/api/others` | access_token + 会期一致 または auth_token(admin) | その他情報一覧を取得 |
| POST | `/api/others` | auth_token(admin) | その他情報を作成 |
| PUT | `/api/others/{id}` | auth_token(admin) | その他情報を部分更新 |
| DELETE | `/api/others/{id}` | auth_token(admin) | その他情報を削除 |
| POST | `/api/others/upload` | auth_token(admin) | その他情報の画像をアップロード |
| POST | `/api/departments/copy` | auth_token(admin) | 別会期の部署名をコピー |
| GET | `/api/search` | access_token + 会期一致 または auth_token(admin) | 会期内のコンテンツを横断検索 |
| GET | `/assets/{key}` | 不要 | ローカルBackendのR2画像配信 |

内部メールAPIは `POST /internal/email/send`。設定・運用は [Email Worker README](../../apps/email-worker/README.md)、HTTP契約は専用OpenAPI文書を参照します。未対応パス・メソッドは実装の404応答です。

## 補足資料

- [認証・ユーザー](auth-users.md)
- [会期・アクセスコード](access-codes.md)
- [コンテンツ](content.md)
- [検索](search.md)
- [ヘルスチェック](health.md)

## 更新と検証

APIを変更するときはroute・middleware・validator・controller・use case・repository/schemaを確認し、対応operationとcomponents、案内を同時更新します。予定のAPIを現行の `paths`へ混ぜません。

2026-10-14の作成時に次を静的検証しました。検証結果はこの確認時点の記録です。

- OAIの3.2保守ブランチのJSON SchemaによるOpenAPI文書構造の検証
- JSON Schema Draft 2020-12による全components schema、28件の例、14件の入力制約ケース
- 制約ケースを実装と照合（12件はZod、2件のレーン条件はmock repositoryを使うuse case）
- 全44 operationのID重複、`$ref`、必要path parameter、security scheme参照
- Backendの全route定義（42操作）と画像配信、Email Workerの内部送信経路との照合

入力Schemaは導入済みZodの `toJSONSchema`（input mode）を使用して実定義から取り込み、refineによる相関制約は説明と必要なSchema条件で補っています。手書きのresponse SchemaはcontrollerとDB型を照合しています。

公開スキーマURLからは取得できなかったため、検証には [OAIの3.2保守schemaソース](https://github.com/OAI/OpenAPI-Specification/blob/85f1be31c4946139b7afca8be3d3694bbad4877f/src/schemas/validation/schema.yaml)を使いました（revision: `85f1be31c4946139b7afca8be3d3694bbad4877f`、schema IDはWORK-IN-PROGRESS）。これは3.2.1の正式リリース検証ツールの実行とは区別します。再検証する際も、選ぶツールが3.2.1を扱えることを確認してください。

`x-source-revision`は今回照合した実装のcommitです。`info.version`は文書の確認日、`openapi`は規格版を示します。実サービスへのAPI呼び出し、DB接続、配信、Swagger UI等での表示は今回検証していません。
