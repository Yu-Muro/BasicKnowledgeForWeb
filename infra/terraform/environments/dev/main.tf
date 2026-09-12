module "project" {
  source = "../../modules/project"

  account_id        = var.account_id
  zone_id           = var.zone_id
  zone_name         = "reitaisai.info"
  hyperdrive_id     = "f7f0ede9c7464673ab6f5bdcf0753218"
  hyperdrive_name   = var.hyperdrive_name
  hyperdrive_origin = var.hyperdrive_origin

  hyperdrive_caching                 = var.hyperdrive_caching
  hyperdrive_mtls                    = var.hyperdrive_mtls
  hyperdrive_origin_connection_limit = var.hyperdrive_origin_connection_limit

  backend_worker_name    = "basic-knowledge-for-web-backend-dev"
  frontend_worker_name   = "basic-knowledge-for-web-frontend-dev"
  asset_bucket_name      = "dev-basicknowledgeforweb"
  next_cache_bucket_name = "basic-knowledge-for-web-next-cache-dev"
  backend_route_pattern  = "dev.reitaisai.info/api/*"
  frontend_hostname      = "dev.reitaisai.info"
  asset_hostname         = "assets.dev.reitaisai.info"
}
