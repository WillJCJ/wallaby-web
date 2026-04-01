variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone and Worker permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Your Cloudflare account ID"
  type        = string
}

variable "environment_name" {
  description = "The environment to deploy to"
  type        = string
  default     = "production"
}

locals {
  my_domain = "wallabyfest.co.uk"
}
