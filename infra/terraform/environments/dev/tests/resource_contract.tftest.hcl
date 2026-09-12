mock_provider "cloudflare" {
  mock_resource "cloudflare_hyperdrive_config" {
    override_during = plan
    defaults = {
      id = "f7f0ede9c7464673ab6f5bdcf0753218"
    }
  }

  mock_data "cloudflare_zone" {
    defaults = {
      id      = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      zone_id = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      name    = "reitaisai.info"
    }
  }

  mock_data "cloudflare_r2_custom_domain" {
    defaults = {
      enabled = true
      domain  = "assets.dev.reitaisai.info"
      status = {
        ownership = "active"
        ssl       = "active"
      }
    }
  }
}

run "dev_resource_contract" {
  command = plan

  variables {
    account_id      = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    zone_id         = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    hyperdrive_name = "dev-database"
    hyperdrive_origin = {
      database = "Dev-BasicKnowledgeForWeb"
      host     = "dev-database.example.com"
      password = format("%s-%s", "test", "password")
      port     = 26257
      scheme   = "postgresql"
      user     = "test-user"
    }
  }

  assert {
    condition     = output.resource_contract.backend_worker_name == "basic-knowledge-for-web-backend-dev"
    error_message = "The dev backend Worker name changed unexpectedly."
  }

  assert {
    condition     = output.resource_contract.frontend_worker_name == "basic-knowledge-for-web-frontend-dev"
    error_message = "The dev frontend Worker name changed unexpectedly."
  }

  assert {
    condition     = output.resource_contract.asset_bucket_name == "dev-basicknowledgeforweb"
    error_message = "The dev asset bucket is wired incorrectly."
  }

  assert {
    condition     = output.resource_contract.next_cache_bucket_name == "basic-knowledge-for-web-next-cache-dev"
    error_message = "The dev OpenNext cache bucket is wired incorrectly."
  }

  assert {
    condition     = output.resource_contract.hyperdrive_id == "f7f0ede9c7464673ab6f5bdcf0753218"
    error_message = "The dev Hyperdrive ID is wired incorrectly."
  }

  assert {
    condition     = output.resource_contract.backend_route_pattern == "dev.reitaisai.info/api/*"
    error_message = "The dev backend route is wired incorrectly."
  }

  assert {
    condition     = output.resource_contract.frontend_hostname == "dev.reitaisai.info"
    error_message = "The dev frontend hostname is wired incorrectly."
  }

  assert {
    condition     = output.resource_contract.asset_hostname == "assets.dev.reitaisai.info"
    error_message = "The dev asset hostname is wired incorrectly."
  }

  assert {
    condition = length(regexall(
      "prevent_destroy\\s*=\\s*true",
      file("${path.module}/../../modules/project/main.tf"),
    )) == 3
    error_message = "All two R2 buckets and Hyperdrive must retain prevent_destroy."
  }
}
