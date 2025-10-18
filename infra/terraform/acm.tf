# ACM cert in us-east-1 for CloudFront
resource "aws_acm_certificate" "site" {
  provider          = aws.use1
  domain_name       = var.domain
  validation_method = "DNS"

  # Only add real SANs: API subdomain and optional site subdomain
  subject_alternative_names = compact([
    "${var.api_subdomain}.${var.domain}",
    var.site_subdomain == "" ? "" : "${var.site_subdomain}.${var.domain}"
  ])

  lifecycle {
    create_before_destroy = true
  }
}

# Create validation DNS records in Route53 (note: uses the hosted zone resource)
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.site.domain_validation_options :
    dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }

  zone_id = aws_route53_zone.primary.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.value]
}

# Wait for validation to complete
resource "aws_acm_certificate_validation" "site" {
  provider                = aws.use1
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# Useful output
output "certificate_arn" {
  value = aws_acm_certificate_validation.site.certificate_arn
}
