# Primary hosted zone for the domainresource "aws_route53_zone" "primary" {

resource "aws_route53_zone" "primary" {  name = var.domain

  name = var.domain}

}
output "route53_nameservers" {
  value = aws_route53_zone.primary.name_servers
}
