#############################################
# Helix AI Infrastructure (clean, working)
#
# This file sets up:
# 1) Frontend: S3 (private) + CloudFront (OAC) + Route53
# 2) API: ECR + Lambda (container image) + HTTP API Gateway + custom domain + Route53
# 3) Secrets: Secrets Manager + IAM permissions for Lambda
# 4) Avatars: S3 bucket + CORS + public-read + Lambda upload perms
# 5) DB: RDS Postgres (publicly accessible for now)
#
# Assumptions / external deps:
# - aws_route53_zone.primary exists in route53.tf
# - aws_acm_certificate_validation.site exists in acm.tf
#   (and that certificate is in us-east-1 for CloudFront + API custom domain)
#############################################

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

#####################################
# Providers
#####################################

provider "aws" {
  region = var.region
}

# CloudFront ACM certs must be in us-east-1
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

variable "db_master_password" {
  type      = string
  sensitive = true
  default   = ""
}

#####################################
# Data / Locals
#####################################

data "aws_caller_identity" "current" {}

locals {
  site_fqdn = var.site_subdomain == "" ? var.domain : "${var.site_subdomain}.${var.domain}"
  api_fqdn  = "${var.api_subdomain}.${var.domain}"

  s3_site_bucket_name    = "${var.project_name}-site-${replace(var.domain, ".", "-")}"
  s3_avatars_bucket_name = "${var.project_name}-avatars-${replace(var.domain, ".", "-")}"

  ecr_repo_name = "${var.project_name}-api"
}

#####################################
# Frontend: S3 (private) + CloudFront (OAC)
#####################################

resource "aws_s3_bucket" "site" {
  bucket = local.s3_site_bucket_name
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
  provider                          = aws.use1
  name                              = "${var.project_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
  description                       = "OAC for ${local.s3_site_bucket_name}"
}

resource "aws_cloudfront_distribution" "cdn" {
  provider            = aws.use1
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
    # Must be us-east-1 ACM cert for CloudFront
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  depends_on = [aws_acm_certificate_validation.site]
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Sid       = "AllowCloudFrontRead",
      Effect    = "Allow",
      Principal = { Service = "cloudfront.amazonaws.com" },
      Action    = ["s3:GetObject"],
      Resource  = "${aws_s3_bucket.site.arn}/*",
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.cdn.arn
        }
      }
    }]
  })
}

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
#####################################

resource "aws_ecr_repository" "api" {
  name         = local.ecr_repo_name
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

#####################################
# ECR repo policy: allow Lambda to pull images
# (fixes: "Lambda does not have permission to access the provided code artifact")
#####################################

resource "aws_ecr_repository_policy" "api_lambda_pull" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "AllowLambdaServicePull",
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        },
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchCheckLayerAvailability"
        ],
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

#####################################
# IAM for Lambda
#####################################

resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Minimal, correct ECR pull permissions for a container-image Lambda (execution role side)
resource "aws_iam_role_policy" "lambda_ecr_pull" {
  name = "${var.project_name}-lambda-ecr-pull"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "EcrPullSpecificRepo",
        Effect = "Allow",
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ],
        Resource = aws_ecr_repository.api.arn
      },
      {
        Sid      = "EcrAuthToken",
        Effect   = "Allow",
        Action   = ["ecr:GetAuthorizationToken"],
        Resource = "*"
      }
    ]
  })
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
    JWT_SECRET   = "REPLACE_ME_WITH_REAL_SECRET"
    DATABASE_URL = "postgresql://${aws_db_instance.postgres.username}:${var.db_master_password}@${aws_db_instance.postgres.address}:5432/${aws_db_instance.postgres.db_name}?schema=public"
  })
}

resource "aws_iam_policy" "secrets_read" {
  name = "${var.project_name}-secrets-read"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["secretsmanager:GetSecretValue"],
      Resource = [aws_secretsmanager_secret.app.arn]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_secrets" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.secrets_read.arn
}

resource "aws_iam_role_policy" "lambda_ssm_read" {
  name = "${var.project_name}-lambda-ssm-read"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Action = ["ssm:GetParameter", "ssm:GetParameters"],
      Resource = "arn:aws:ssm:${var.region}:*:parameter/helix/prod/*"
    }]
  })
}

#####################################
# RDS PostgreSQL (provisioned)
#####################################

resource "aws_default_vpc" "default" {
  tags = { Name = "Default VPC" }
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [aws_default_vpc.default.id]
  }
}

resource "aws_db_subnet_group" "db" {
  name       = "${var.project_name}-db-subnet"
  subnet_ids = data.aws_subnets.default.ids
  tags = { Name = "${var.project_name}-db-subnet-group" }
}

resource "aws_security_group" "db" {
  name        = "${var.project_name}-db-sg"
  description = "Allow PostgreSQL access (initial setup)"
  vpc_id      = aws_default_vpc.default.id

  ingress {
    description = "PostgreSQL from anywhere (initial setup)"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # tighten later
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-db-sg" }
}

resource "aws_db_instance" "postgres" {
  identifier              = "${var.project_name}-postgres"
  engine                  = "postgres"
  engine_version          = "16.10"
  instance_class          = "db.t3.micro"
  allocated_storage       = 20

  db_name   = "helix"
  username  = "postgres"
  password  = var.db_master_password

  db_subnet_group_name   = aws_db_subnet_group.db.name
  vpc_security_group_ids = [aws_security_group.db.id]

  publicly_accessible     = true
  skip_final_snapshot     = true
  backup_retention_period = 7
}

#####################################
# S3 Bucket for Avatar Uploads
#####################################

resource "aws_s3_bucket" "avatars" {
  bucket = local.s3_avatars_bucket_name
}

resource "aws_s3_bucket_public_access_block" "avatars" {
  bucket = aws_s3_bucket.avatars.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_cors_configuration" "avatars" {
  bucket = aws_s3_bucket.avatars.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://${local.site_fqdn}", "http://localhost:5173"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_policy" "avatars_public_read" {
  bucket = aws_s3_bucket.avatars.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Sid       = "PublicReadGetObject",
      Effect    = "Allow",
      Principal = "*",
      Action    = "s3:GetObject",
      Resource  = "${aws_s3_bucket.avatars.arn}/*"
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.avatars]
}

# Lambda upload perms (no ACLs required since bucket policy grants public read)
resource "aws_iam_role_policy" "lambda_s3_avatars" {
  name = "${var.project_name}-lambda-s3-avatars"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["s3:PutObject"],
      Resource = "${aws_s3_bucket.avatars.arn}/*"
    }]
  })
}

#####################################
# Lambda (container image)
#####################################

resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api"
  package_type  = "Image"

  # This tag MUST exist in ECR
  image_uri = "${aws_ecr_repository.api.repository_url}:latest-lambda"

  role          = aws_iam_role.lambda_exec.arn
  timeout       = 30
  memory_size   = 1024
  architectures = ["x86_64"]

  environment {
    variables = {
      NODE_ENV         = "production"
      SECRETS_NAME     = aws_secretsmanager_secret.app.name
      USE_AWS_SECRETS  = "true"
      PARAMETER_PREFIX = "/helix/prod"
      ALLOWED_ORIGINS  = "https://${local.site_fqdn}"
      S3_AVATAR_BUCKET = aws_s3_bucket.avatars.id
      AWS_REGION       = var.region
    }
  }

  depends_on = [
    aws_ecr_repository_policy.api_lambda_pull,
    aws_iam_role_policy.lambda_ecr_pull,
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.lambda_secrets
  ]
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

resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = local.api_fqdn

  domain_name_configuration {
    # Regional custom domain supports us-east-1 cert fine
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

output "site_url"          { value = "https://${local.site_fqdn}" }
output "api_url"           { value = "https://${local.api_fqdn}" }
output "cloudfront_domain" { value = aws_cloudfront_distribution.cdn.domain_name }
output "apigw_execute_url" { value = aws_apigatewayv2_api.http.api_endpoint }
output "ecr_repo"          { value = aws_ecr_repository.api.repository_url }
output "rds_endpoint"      { value = aws_db_instance.postgres.address }
output "rds_database_name" { value = aws_db_instance.postgres.db_name }
output "s3_avatar_bucket"  { value = aws_s3_bucket.avatars.id }