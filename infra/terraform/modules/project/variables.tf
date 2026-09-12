variable "account_id" {
  description = "Cloudflare account ID."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.account_id))
    error_message = "account_id must be a 32-character hexadecimal Cloudflare account ID."
  }
}

variable "zone_id" {
  description = "Cloudflare zone ID for reitaisai.info."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.zone_id))
    error_message = "zone_id must be a 32-character hexadecimal Cloudflare zone ID."
  }
}

variable "zone_name" {
  description = "Existing Cloudflare zone name. The zone itself is not managed by this module."
  type        = string
}

variable "backend_worker_name" {
  description = "Backend Worker name."
  type        = string
}

variable "frontend_worker_name" {
  description = "Frontend Worker name."
  type        = string
}

variable "asset_bucket_name" {
  description = "R2 bucket used for application images."
  type        = string
}

variable "next_cache_bucket_name" {
  description = "R2 bucket used by OpenNext incremental cache."
  type        = string
}

variable "backend_route_pattern" {
  description = "Workers route that sends /api requests to the backend Worker."
  type        = string
}

variable "frontend_hostname" {
  description = "Custom domain attached to the frontend Worker."
  type        = string
}

variable "asset_hostname" {
  description = "Existing custom domain attached to the application asset bucket."
  type        = string
}

variable "hyperdrive_name" {
  description = "Existing Hyperdrive configuration name."
  type        = string
}

variable "hyperdrive_id" {
  description = "Existing Hyperdrive configuration ID used as an import safety check."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.hyperdrive_id))
    error_message = "hyperdrive_id must be a 32-character lowercase hexadecimal Cloudflare ID."
  }
}

variable "hyperdrive_origin" {
  description = "Origin connection settings for the existing Hyperdrive configuration."
  sensitive   = true
  type = object({
    database             = string
    password             = string
    scheme               = string
    user                 = string
    host                 = optional(string)
    port                 = optional(number)
    service_id           = optional(string)
    access_client_id     = optional(string)
    access_client_secret = optional(string)
  })

  validation {
    condition     = contains(["postgres", "postgresql", "mysql"], var.hyperdrive_origin.scheme)
    error_message = "hyperdrive_origin.scheme must be postgres, postgresql, or mysql."
  }
}

variable "hyperdrive_caching" {
  description = "Optional Hyperdrive cache settings copied from the live configuration."
  type = object({
    disabled               = optional(bool)
    max_age                = optional(number)
    stale_while_revalidate = optional(number)
  })
  default = null
}

variable "hyperdrive_mtls" {
  description = "Optional Hyperdrive mTLS settings copied from the live configuration."
  type = object({
    ca_certificate_id   = optional(string)
    mtls_certificate_id = optional(string)
    sslmode             = optional(string)
  })
  default = null
}

variable "hyperdrive_origin_connection_limit" {
  description = "Optional Hyperdrive origin connection limit copied from the live configuration."
  type        = number
  default     = null
}
