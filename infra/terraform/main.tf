# Helix AI Infrastructure
# This Terraform configuration sets up:
# 1. Static site hosting (S3 + CloudFront)
# 2. API (Lambda + API Gateway)
# 3. DNS and SSL certificates
# 4. Secrets management and IAM roles

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

#####################################
# Providers
#####################################

provider "aws" {
  region = var.region
}

# CloudFront requires ACM certs in us-east-1; keep a second provider alias
provider "aws" {
  alias  = "use1"
  region = "us-east-1"
}

#####################################
# Variables
#####################################

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "domain" {
  type    = string
  default = "helixai.live"
}

variable "site_subdomain" {
  type        = string
  default     = "" # "" = apex
  description = "Subdomain for the frontend site. Empty string means use apex domain."
}

variable "api_subdomain" {
  type        = string
  default     = "api"
  description = "Subdomain for the API endpoint"
}

variable "project_name" {
  type        = string
  default     = "helixai"
  description = "Project name used in resource naming"
}

#####################################
# Locals
#####################################

locals {
  site_fqdn      = var.site_subdomain == "" ? var.domain : "${var.site_subdomain}.${var.domain}"
  api_fqdn       = "${var.api_subdomain}.${var.domain}"
  s3_bucket_name = "${var.project_name}-site-${replace(var.domain, ".", "-")}"
}

#####################################
# DNS (Route 53 hosted zone)
#####################################
# moved to route53.tf (aws_route53_zone.primary)

#####################################
# Certificates (ACM)
#####################################
# SITE cert lives in acm.tf (aws_acm_certificate.site + validation)
# Reuse that cert for CloudFront and API custom domain.

#####################################
# Frontend: S3 (private) + CloudFront (OAC)
# 
# Architecture:
# - Private S3 bucket hosts static assets
# - CloudFront provides CDN and HTTPS
# - Origin Access Control (OAC) secures S3 access
#####################################

resource "aws_s3_bucket" "site" {
  bucket = local.s3_bucket_name
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${var.project_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
  description                       = "OAC for ${local.s3_bucket_name}"
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  aliases = [local.site_fqdn]

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "site-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  default_cache_behavior {
    target_origin_id       = "site-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  depends_on = [aws_acm_certificate_validation.site]
}

# Lock S3 reads to this specific CloudFront distribution (OAC)
resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Sid : "AllowCloudFrontRead",
      Effect : "Allow",
      Principal : { Service : "cloudfront.amazonaws.com" },
      Action : ["s3:GetObject"],
      Resource : "${aws_s3_bucket.site.arn}/*",
      Condition : {
        StringEquals : {
          "AWS:SourceArn" : aws_cloudfront_distribution.cdn.arn
        }
      }
    }]
  })
}

# DNS A/AAAA alias for site → CloudFront
resource "aws_route53_record" "site_alias_ipv4" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = local.site_fqdn
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.cdn.domain_name
    zone_id                = aws_cloudfront_distribution.cdn.hosted_zone_id
    evaluate_target_health = false
  }
}
resource "aws_route53_record" "site_alias_ipv6" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = local.site_fqdn
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.cdn.domain_name
    zone_id                = aws_cloudfront_distribution.cdn.hosted_zone_id
    evaluate_target_health = false
  }
}

#####################################
# ECR (container registry) for API image
# 
# API is containerized for better dependency management
# and consistent deployments. ECR hosts the container
# image that Lambda will run.
#####################################

resource "aws_ecr_repository" "api" {
  name         = "${var.project_name}-api"
  force_delete = true
  image_scanning_configuration { scan_on_push = true }
}

#####################################
# IAM for Lambda
#
# Lambda needs permissions for:
# 1. Basic execution (CloudWatch logs)
# 2. Pulling from ECR
# 3. Reading from Secrets Manager
#####################################

resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect : "Allow",
      Principal : { Service : "lambda.amazonaws.com" },
      Action : "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Allow Lambda to pull container images from ECR
resource "aws_iam_role_policy_attachment" "lambda_ecr_pull" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaECRImageRetrievalRolePolicy"
}

#####################################
# Secrets Manager (+ permission for Lambda)
#####################################

resource "aws_secretsmanager_secret" "app" {
  name = "${var.project_name}-secrets"
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    JWT_SECRET = "REPLACE_ME"
  })
}

resource "aws_iam_policy" "secrets_read" {
  name = "${var.project_name}-secrets-read"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect : "Allow",
      Action : ["secretsmanager:GetSecretValue"],
      Resource : [aws_secretsmanager_secret.app.arn]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_secrets" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.secrets_read.arn
}

#####################################
# Lambda (container image)
#
# Main API runtime:
# - Container-based deployment
# - 15s timeout for longer operations
# - 512MB memory for ML workloads
# - Access to secrets and CORS config
#####################################

resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api"
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.api.repository_url}:latest"
  role          = aws_iam_role.lambda_exec.arn
  timeout       = 15
  memory_size   = 512
  architectures = ["x86_64"]

  environment {
    variables = {
      SECRETS_NAME   = aws_secretsmanager_secret.app.name
      ALLOWED_ORIGIN = "https://${local.site_fqdn}"
    }
  }
}

#####################################
# API Gateway (HTTP API) + custom domain
#####################################

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project_name}-http-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["https://${local.site_fqdn}"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Authorization", "Content-Type"]
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGWInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# API custom domain with the SAME cert (issued in us-east-1)
resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = local.api_fqdn
  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.site.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
  depends_on = [aws_acm_certificate_validation.site]
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.http.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.prod.id
}

# DNS A/AAAA alias for api → API Gateway regional domain
resource "aws_route53_record" "api_alias_ipv4" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = local.api_fqdn
  type    = "A"
  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
resource "aws_route53_record" "api_alias_ipv6" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = local.api_fqdn
  type    = "AAAA"
  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

#####################################
# Outputs
#####################################

output "site_url" { value = "https://${local.site_fqdn}" }
output "api_url" { value = "https://${local.api_fqdn}" }
output "cloudfront_domain" { value = aws_cloudfront_distribution.cdn.domain_name }
output "apigw_execute_url" { value = aws_apigatewayv2_api.http.api_endpoint }
output "ecr_repo" { value = aws_ecr_repository.api.repository_url }
