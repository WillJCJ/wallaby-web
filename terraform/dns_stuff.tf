# Look up your existing hosted zone
data "aws_route53_zone" "wallabyfest" {
  name = local.my_domain
}

# Replace the NS record with Cloudflare's nameservers
resource "aws_route53_record" "wallabyfest_ns" {
  zone_id = data.aws_route53_zone.wallabyfest.zone_id
  name    = "wallabyfest.co.uk"
  type    = "NS"
  ttl     = 86400

  records = cloudflare_zone.wallabyfest.name_servers

  # Replace existing AWS records with Cloudflare ones
  allow_overwrite = true
}
