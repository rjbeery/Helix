resource "aws_route53_zone" "primary" {
  name = var.domain
}

output "route53_nameservers" {
  value = aws_route53_zone.primary.name_servers
}
