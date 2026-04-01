output "cloudflare_nameservers" {
  description = "These are now set in Route 53 automatically"
  value       = cloudflare_zone.wallabyfest.name_servers
}

output "worker_url" {
  value = "https://${local.my_domain}"
}
