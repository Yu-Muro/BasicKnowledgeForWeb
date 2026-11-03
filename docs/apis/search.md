# 検索APIの補足

契約の正本は [openapi.yaml](openapi.yaml)の `searchContent`です。[API案内](README.md)へ戻る。

`GET /api/search`は `x-event-id`とクエリ `q`を要求します。検索語はtrim後に1文字以上で、空白だけの値は拒否します。access_tokenの会期一致、またはauth_token(admin)で許可します。

レスポンスの5配列は `timetable`・`rooms`・`programs`・`shopItems`・`otherItems`です。各要素は一覧と同じSchemaを使い、時間割は部署タグ情報も含みます。部署そのものの検索配列はありません。

実装: `searchRoutes.ts` / `searchController.ts` / `searchValidator.ts` / `ISearchUseCase.ts`。
