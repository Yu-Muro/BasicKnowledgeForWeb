data "cloudflare_zone" "project" {
  zone_id = var.zone_id

  lifecycle {
    postcondition {
      condition     = self.name == var.zone_name
      error_message = "The supplied zone_id does not belong to the expected zone_name."
    }
  }
}

resource "cloudflare_worker" "backend" {
  account_id = var.account_id
  name       = var.backend_worker_name
}

resource "cloudflare_worker" "frontend" {
  account_id = var.account_id
  name       = var.frontend_worker_name
}

resource "cloudflare_r2_bucket" "assets" {
  account_id = var.account_id
  name       = var.asset_bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket" "next_cache" {
  account_id = var.account_id
  name       = var.next_cache_bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_hyperdrive_config" "database" {
  account_id              = var.account_id
  name                    = var.hyperdrive_name
  origin                  = var.hyperdrive_origin
  caching                 = var.hyperdrive_caching
  mtls                    = var.hyperdrive_mtls
  origin_connection_limit = var.hyperdrive_origin_connection_limit

  lifecycle {
    prevent_destroy = true

    postcondition {
      condition     = self.id == var.hyperdrive_id
      error_message = "The managed Hyperdrive ID does not match the expected imported resource."
    }
  }
}

resource "cloudflare_workers_route" "backend_api" {
  zone_id = data.cloudflare_zone.project.id
  pattern = var.backend_route_pattern
  script  = cloudflare_worker.backend.name
}

resource "cloudflare_workers_custom_domain" "frontend" {
  account_id = var.account_id
  hostname   = var.frontend_hostname
  service    = cloudflare_worker.frontend.name
  zone_id    = data.cloudflare_zone.project.id
}

# Provider 5.24 cannot import an existing R2 custom domain. Keep it as a
# fail-closed read assertion until import support is added to the provider.
data "cloudflare_r2_custom_domain" "assets" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.assets.name
  domain      = var.asset_hostname

  lifecycle {
    postcondition {
      condition = (
        self.enabled &&
        self.status.ownership == "active" &&
        self.status.ssl == "active"
      )
      error_message = "The expected R2 asset custom domain is not enabled and active."
    }
  }
}
