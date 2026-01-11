
# Create Route53 records for the CloudFront distribution aliases
data "aws_route53_zone" "my_domain" {
  name = local.my_domain
}

resource "aws_route53_record" "cloudfront" {
  for_each = aws_cloudfront_distribution.wallaby_web.aliases
  zone_id  = data.aws_route53_zone.my_domain.zone_id
  name     = each.value
  type     = "A"

  alias {
    name                   = aws_cloudfront_distribution.wallaby_web.domain_name
    zone_id                = aws_cloudfront_distribution.wallaby_web.hosted_zone_id
    evaluate_target_health = false
  }
}
