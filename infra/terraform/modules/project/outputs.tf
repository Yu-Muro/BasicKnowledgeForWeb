output "resource_contract" {
  description = "Stable names and IDs consumed by Wrangler and deployment checks."
  value = {
    zone_id                = data.cloudflare_zone.project.id
    zone_name              = data.cloudflare_zone.project.name
    backend_worker_name    = cloudflare_worker.backend.name
    frontend_worker_name   = cloudflare_worker.frontend.name
    asset_bucket_name      = cloudflare_r2_bucket.assets.name
    next_cache_bucket_name = cloudflare_r2_bucket.next_cache.name
    hyperdrive_id          = cloudflare_hyperdrive_config.database.id
    backend_route_pattern  = cloudflare_workers_route.backend_api.pattern
    frontend_hostname      = cloudflare_workers_custom_domain.frontend.hostname
    asset_hostname         = data.cloudflare_r2_custom_domain.assets.domain
  }
}
