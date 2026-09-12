module "project" {
  source = "../../modules/project"

  account_id        = var.account_id
  zone_id           = var.zone_id
  zone_name         = "reitaisai.info"
  hyperdrive_id     = "5a36ae3ca5ed4a4697040c00685f213e"
  hyperdrive_name   = var.hyperdrive_name
  hyperdrive_origin = var.hyperdrive_origin

  hyperdrive_caching                 = var.hyperdrive_caching
  hyperdrive_mtls                    = var.hyperdrive_mtls
  hyperdrive_origin_connection_limit = var.hyperdrive_origin_connection_limit

  backend_worker_name    = "basic-knowledge-for-web-backend"
  frontend_worker_name   = "basic-knowledge-for-web-frontend"
  asset_bucket_name      = "basicknowledgeforweb"
  next_cache_bucket_name = "basic-knowledge-for-web-next-cache"
  backend_route_pattern  = "reitaisai.info/api/*"
  frontend_hostname      = "reitaisai.info"
  asset_hostname         = "assets.reitaisai.info"
}
