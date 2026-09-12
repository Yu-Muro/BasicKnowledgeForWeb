mock_provider "cloudflare" {
  mock_resource "cloudflare_hyperdrive_config" {
    override_during = plan
    defaults = {
      id = "5a36ae3ca5ed4a4697040c00685f213e"
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
      domain  = "assets.reitaisai.info"
      status = {
        ownership = "active"
        ssl       = "active"
      }
    }
  }
}

run "prod_resource_contract" {
  command = plan

  variables {
    account_id      = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    zone_id         = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    hyperdrive_name = "production-database"
    hyperdrive_origin = {
      database = "BasicKnowledgeForWeb"
      host     = "production-database.example.com"
      password = format("%s-%s", "test", "password")
      port     = 26257
      scheme   = "postgresql"
      user     = "test-user"
    }
  }

  assert {
    condition     = output.resource_contract.backend_worker_name == "basic-knowledge-for-web-backend"
    error_message = "The production backend Worker name changed unexpectedly."
  }

  assert {
    condition     = output.resource_contract.frontend_worker_name == "basic-knowledge-for-web-frontend"
    error_message = "The production frontend Worker name changed unexpectedly."
  }

  assert {
    condition     = output.resource_contract.asset_bucket_name == "basicknowledgeforweb"
    error_message = "The production asset bucket is wired incorrectly."
  }

  assert {
    condition     = output.resource_contract.next_cache_bucket_name == "basic-knowledge-for-web-next-cache"
    error_message = "The production OpenNext cache bucket is wired incorrectly."
  }

  assert {
    condition     = output.resource_contract.hyperdrive_id == "5a36ae3ca5ed4a4697040c00685f213e"
    error_message = "The production Hyperdrive ID is wired incorrectly."
  }

  assert {
    condition     = output.resource_contract.backend_route_pattern == "reitaisai.info/api/*"
    error_message = "The production backend route is wired incorrectly."
  }

  assert {
    condition     = output.resource_contract.frontend_hostname == "reitaisai.info"
    error_message = "The production frontend hostname is wired incorrectly."
  }

  assert {
    condition     = output.resource_contract.asset_hostname == "assets.reitaisai.info"
    error_message = "The production asset hostname is wired incorrectly."
  }

  assert {
    condition = length(regexall(
      "prevent_destroy\\s*=\\s*true",
      file("${path.module}/../../modules/project/main.tf"),
    )) == 3
    error_message = "All two R2 buckets and Hyperdrive must retain prevent_destroy."
  }
}
