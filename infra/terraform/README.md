# Cloudflare Terraform運用手順

このディレクトリは、このプロジェクト固有のCloudflareリソースを管理します。`reitaisai.info`ゾーン全体、Workerコード、Workerバージョン、bindings、observability、`JWT_SECRET`は管理対象外です。

## 必要バージョン

- Terraform `>= 1.10.0`
- Cloudflare Provider `>= 5.24.0`

Providerは最低バージョンだけを指定し、実際に検証したバージョンは各環境の`.terraform.lock.hcl`で固定します。Provider更新時だけ`terraform init -upgrade`を実行してください。

## 管理境界

Terraformが管理するもの:

- backend / frontend Worker本体
- アプリ画像用R2、OpenNextキャッシュ用R2
- Hyperdrive
- backend Workers Route
- frontend Workers Custom Domain

Wranglerが管理するもの:

- Workerコード、バージョン、静的アセット
- R2、Hyperdrive、service bindings
- compatibility設定、平文変数、observability、`JWT_SECRET`

Cloudflare Provider 5.24は、既存のR2 Custom Domain、R2 CORS、R2 Lifecycleをimportできません。既存設定を削除・再作成しないため、R2 Custom Domainはデータソースで存在とactive状態を検証します。CORSとLifecycleはライブ棚卸し結果をrunbookへ保存し、ProviderがimportをサポートするまでWranglerまたはDashboard管理を継続します。

## Stateバケットの初期化

stateバケットは自身のstateに含められないため、ブートストラップ例外として一度だけ作成します。

```bash
wrangler r2 bucket create basic-knowledge-for-web-terraform-state
wrangler r2 bucket lifecycle add basic-knowledge-for-web-terraform-state terraform-state-backups backups/ --expire-days 90
```

R2 Dashboardで、このバケットだけにObject Read & Write権限を持つS3 API tokenを作成します。Terraformは以下を使用します。

- bucket: `basic-knowledge-for-web-terraform-state`
- dev key: `basic-knowledge-for-web/dev/terraform.tfstate`
- prod key: `basic-knowledge-for-web/prod/terraform.tfstate`
- lock: 各state keyの`.tflock`
- backup: `backups/{environment}/{timestamp}.tfstate`

ローカル実行前に以下を設定します。

```bash
export AWS_ACCESS_KEY_ID='<R2 access key ID>'
export AWS_SECRET_ACCESS_KEY='<R2 secret access key>'
export AWS_ENDPOINT_URL_S3='https://<ACCOUNT_ID>.r2.cloudflarestorage.com'
export CLOUDFLARE_API_TOKEN='<Cloudflare API token>'
export TF_VAR_account_id='<ACCOUNT_ID>'
export TF_VAR_zone_id='<ZONE_ID>'
export TF_VAR_hyperdrive_name='<live Hyperdrive name>'
export TF_VAR_hyperdrive_origin='{"database":"...","host":"...","password":"...","port":26257,"scheme":"postgresql","user":"..."}'
```

秘密値を`.tfvars`やシェル履歴へ保存しないでください。Hyperdrive originはTerraform stateにも保存されるため、stateバケットの資格情報を管理者だけに限定します。

## GitHub Environment設定

`dev`と`prod`へ環境別に登録します。

Variables:

- `TERRAFORM_IAC_ENABLED`: importとゼロ差分確認が完了するまでは`false`、完了後に`true`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_HYPERDRIVE_NAME`

Secrets:

- `TF_PLAN_CLOUDFLARE_API_TOKEN`: plan用Cloudflare読取専用token
- `CLOUDFLARE_API_TOKEN`: applyとWrangler deploy用token
- `TF_PLAN_STATE_ACCESS_KEY_ID` / `TF_PLAN_STATE_SECRET_ACCESS_KEY`: plan用R2読取token
- `TF_STATE_ACCESS_KEY_ID` / `TF_STATE_SECRET_ACCESS_KEY`: apply用R2読書きtoken
- `TF_HYPERDRIVE_ORIGIN`: `hyperdrive_origin`オブジェクトのJSON
- 既存の`DATABASE_URL` / `JWT_SECRET`

prod Environmentにはrequired reviewerを設定します。

## ライブ棚卸し

import前に、devとprodのそれぞれで次を確認します。

```bash
wrangler deployments list --name <WORKER_NAME>
wrangler r2 bucket list
wrangler r2 bucket domain list <ASSET_BUCKET_NAME>
wrangler r2 bucket cors list <ASSET_BUCKET_NAME>
wrangler r2 bucket lifecycle list <ASSET_BUCKET_NAME>
wrangler r2 bucket lifecycle list <NEXT_CACHE_BUCKET_NAME>
wrangler hyperdrive get <HYPERDRIVE_ID>
wrangler secret list --name <WORKER_NAME>
```

Cloudflare DashboardまたはAPIで、backend route IDとfrontend custom domain IDも取得します。別用途のリソースが同じhostnameを所有している場合は作業を停止してください。

## import

devから実施します。

1. 対象環境で`terraform init`を実行する。
2. `imports.tf.example`を`imports.tf`へコピーし、棚卸ししたIDへ置換する。
3. `terraform plan -out=tfplan`を実行する。
4. create、replace、deleteが含まれていないことを確認してapplyする。
5. 通常の`terraform plan`が`No changes`になるまで、Hyperdriveのcache、mTLS、connection limitなどをライブ値へ合わせる。
6. `imports.tf`とplanファイルを削除する。
7. `TERRAFORM_IAC_ENABLED=true`に変更する。

devのsmoke test完了後にprodで同じ手順を実施します。

R2 Custom Domain、CORS、LifecycleはProviderがimport非対応のため、`imports.tf`へ追加しないでください。

## 通常運用

```bash
terraform fmt -check -recursive infra/terraform
terraform -chdir=infra/terraform/environments/dev init
terraform -chdir=infra/terraform/environments/dev validate
terraform -chdir=infra/terraform/environments/dev test
terraform -chdir=infra/terraform/environments/dev plan
```

本番は`dev`を`prod`へ置き換えます。`terraform apply`はGitHub Actionsからのみ実施します。

## ロールバック

- Workerコード: 対象コミットをrevertしてWranglerで再デプロイ
- Terraform設定: 対象コミットをrevertし、plan確認後にapply
- R2とHyperdrive: 削除・再作成によるロールバックは禁止
- state破損時: `backups/{environment}/`の直近stateを確認し、他のapplyが動いていない状態で復旧
