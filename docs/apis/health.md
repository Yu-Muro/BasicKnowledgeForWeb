# ヘルスチェックAPIの補足

契約の正本は [openapi.yaml](openapi.yaml)の `getHealth`です。[API案内](README.md)へ戻る。

`GET /api/health`は認証不要で、DB接続を確認します。成功は200の `{status: ok, db: connected}`、DB接続失敗は503の `{status: error, db: disconnected}`です。未処理例外の500応答とは区別します。

実装: `healthRoutes.ts` / `healthController.ts` / `CheckDatabaseHealthUseCase.ts`。今回の仕様書作成では実環境のDB疎通を確認していません。
