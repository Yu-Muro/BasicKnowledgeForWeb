variable "account_id" {
  description = "Cloudflare account ID."
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone ID for reitaisai.info."
  type        = string
}

variable "hyperdrive_name" {
  description = "Existing production Hyperdrive configuration name."
  type        = string
}

variable "hyperdrive_origin" {
  description = "Origin connection settings for the existing production Hyperdrive configuration."
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
}

variable "hyperdrive_caching" {
  description = "Optional production Hyperdrive cache settings."
  type = object({
    disabled               = optional(bool)
    max_age                = optional(number)
    stale_while_revalidate = optional(number)
  })
  default = null
}

variable "hyperdrive_mtls" {
  description = "Optional production Hyperdrive mTLS settings."
  type = object({
    ca_certificate_id   = optional(string)
    mtls_certificate_id = optional(string)
    sslmode             = optional(string)
  })
  default = null
}

variable "hyperdrive_origin_connection_limit" {
  description = "Optional production Hyperdrive origin connection limit."
  type        = number
  default     = null
}
