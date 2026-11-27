# コンテンツAPIの補足

契約の正本は [openapi.yaml](openapi.yaml)の `Timetable` / `Room` / `Program` / `ShopItem` / `Department` / `OtherItem`です。[API案内](README.md)へ戻る。

会期コンテンツの閲覧はaccess_tokenの会期一致、またはauth_token(admin)で許可し、UUIDの `x-event-id`が必要です。編集はauth_token(admin)と会期ヘッダーが必要で、POSTの `event_id`はヘッダーに一致させます。全会期共通の部署一覧は認証・会期指定不要で、部署の変更はadmin専用です。更新は定義された項目を1つ以上指定し、未知の項目だけの本文は拒否します。

| 分類 | 補足 |
|---|---|
| 時間割 | end_time省略時はstart_timeと同値。終了は開始以降。is_publicと部署タグにより表示レーンを指定し、少なくとも1つのレーンが必要。レスポンスにはdepartmentsも含む |
| 部屋割り | preDayはnullable、day担当は必須。部署名をJOINした結果を返す |
| 企画 | 終了は開始より後。任意のimage_keyはprograms/{会期}/で始まること |
| 販売物 | 非負の整数priceとimage_keyが必須。キーはshop-items/{会期}/ |
| 部署 | 全会期共通で名称は一意。コピーAPIは廃止。ユーザー・部屋・時間割から参照中の削除は409。統合中の変更は503 |
| その他 | display_orderは非負整数。任意のimage_keyはothers/{会期}/ |

時間割・部屋割り・企画・販売物・その他のGET一覧はCache-Control/Pragma/Expiresを設定します。部署一覧は同じキャッシュヘッダーを設定しません。

企画・販売物・その他のuploadはmultipartのfileをそのままR2へ保存します。アップロードキーをCRUDのimage_keyへ渡す流れで、画像変換・MIMEやサイズの独自制限はありません。OpenAPI 3.2.1のバイナリ記述と、各operationの説明を確認してください。

画面での扱いは [画面仕様](../README.md#画面仕様)を参照します。
