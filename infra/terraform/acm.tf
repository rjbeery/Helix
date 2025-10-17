# ACM certificate for *.domain.com in us-east-1 (required for CloudFront)# ACM cert in us-east-1 for CloudFront

# This same cert is used for both the site (CloudFront) and API custom domainresource "aws_acm_certificate" "site" {

resource "aws_acm_certificate" "site" {  provider          = aws.use1

  provider = aws.use1  # Must be in us-east-1 for CloudFront  domain_name       = var.domain

  validation_method = "DNS"

  domain_name               = "*.${var.domain}"

  subject_alternative_names = [var.domain]  # Only add real SANs: API subdomain and optional site subdomain

  validation_method         = "DNS"  subject_alternative_names = compact([

    "${var.api_subdomain}.${var.domain}",

  lifecycle {    var.site_subdomain == "" ? "" : "${var.site_subdomain}.${var.domain}"

    create_before_destroy = true  ])

  }

}  lifecycle {

    create_before_destroy = true

# DNS records for ACM validation  }

resource "aws_route53_record" "cert_validation" {}

  for_each = {

    for dvo in aws_acm_certificate.site.domain_validation_options : dvo.domain_name => {# Create validation DNS records in Route53 (note: uses the hosted zone resource)

      name   = dvo.resource_record_nameresource "aws_route53_record" "cert_validation" {

      record = dvo.resource_record_value  for_each = {

      type   = dvo.resource_record_type    for dvo in aws_acm_certificate.site.domain_validation_options :

    }    dvo.domain_name => {

  }      name  = dvo.resource_record_name

      type  = dvo.resource_record_type

  zone_id = aws_route53_zone.primary.zone_id      value = dvo.resource_record_value

  name    = each.value.name    }

  type    = each.value.type  }

  records = [each.value.record]

  ttl     = 60  zone_id = aws_route53_zone.primary.zone_id

}  name    = each.value.name

  type    = each.value.type

# Certificate validation  ttl     = 60

resource "aws_acm_certificate_validation" "site" {  records = [each.value.value]

  provider = aws.use1}



  certificate_arn         = aws_acm_certificate.site.arn# Wait for validation to complete

  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]resource "aws_acm_certificate_validation" "site" {

}  provider                = aws.use1
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# Useful output
output "certificate_arn" {
  value = aws_acm_certificate_validation.site.certificate_arn
}
