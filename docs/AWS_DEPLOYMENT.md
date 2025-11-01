# AWS Deployment Guide for Helix

This guide walks you through deploying Helix to AWS with full feature parity to local development.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Docker installed and running
- Terraform installed (>= 1.6.0)
- Node.js and pnpm installed
- AWS account with Route 53 domain configured

## Architecture Overview

- **Frontend**: S3 + CloudFront (static site)
- **Backend**: Lambda (container) + API Gateway
- **Database**: RDS PostgreSQL
- **Storage**: S3 bucket for avatar uploads
- **Secrets**: Secrets Manager + Parameter Store
- **DNS**: Route 53 + ACM certificates

## Step-by-Step Deployment

### 1. Infrastructure Setup (First Time Only)

```powershell
cd infra/terraform

# Initialize Terraform
terraform init

# Review the plan
terraform plan -var="db_master_password=YOUR_SECURE_PASSWORD"

# Apply (creates all AWS resources)
terraform apply -var="db_master_password=YOUR_SECURE_PASSWORD"
```

**Outputs to note:**
- `ecr_repo`: ECR repository URL for API container
- `rds_endpoint`: Database endpoint
- `s3_avatar_bucket`: Avatar storage bucket name
- `api_url`: API Gateway URL (e.g., https://api.helixai.live)
- `site_url`: CloudFront URL (e.g., https://helixai.live)

### 2. Configure Secrets

#### A. Update JWT Secret in Secrets Manager

```powershell
# Generate a secure JWT secret
$jwtSecret = -join ((65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Update the secret (replace the REPLACE_ME_WITH_REAL_SECRET)
aws secretsmanager put-secret-value `
  --secret-id helixai-secrets `
  --secret-string "{\"JWT_SECRET\":\"$jwtSecret\",\"DATABASE_URL\":\"<from terraform output>\"}"
```

#### B. Add Admin Credentials and API Keys to Parameter Store

```powershell
# Run the setup script
.\setup-aws-secrets.ps1 -AwsProfile your-profile -AwsRegion us-east-1

# Or manually:
aws ssm put-parameter --name /helix/prod/ADMIN_EMAIL --value "your@email.com" --type String
aws ssm put-parameter --name /helix/prod/ADMIN_PASSWORD --value "your-secure-password" --type SecureString

# Add LLM API keys
aws ssm put-parameter --name /helix/prod/OPENAI_API_KEY --value "sk-..." --type SecureString
aws ssm put-parameter --name /helix/prod/ANTHROPIC_API_KEY --value "sk-ant-..." --type SecureString
```

#### C. Update Lambda Environment Variables

After adding API keys to Parameter Store, update the Lambda function to load them:

```powershell
aws lambda update-function-configuration `
  --function-name helixai-api `
  --environment "Variables={
    NODE_ENV=production,
    USE_AWS_SECRETS=true,
    PARAMETER_PREFIX=/helix/prod,
    S3_AVATAR_BUCKET=helixai-avatars,
    AWS_REGION=us-east-1,
    ALLOWED_ORIGINS=https://helixai.live
  }"
```

### 3. Build and Deploy API

```powershell
# Build and push API container to ECR
.\deploy-all.ps1 `
  -AwsProfile your-profile `
  -AwsRegion us-east-1 `
  -EcrAccountId YOUR_AWS_ACCOUNT_ID `
  -EcrApiRepo helixai-api `
  -ImageTag latest
```

This script will:
1. Build the Lambda-optimized API container
2. Push to ECR
3. Update Lambda function to use the new image

### 4. Setup Database

```powershell
# Run migrations and seed database
.\deploy-db-setup.ps1 `
  -AwsProfile your-profile `
  -AwsRegion us-east-1
```

This will:
1. Run Prisma migrations
2. Seed engines (GPT-4, Claude, etc.)
3. Create admin user (if credentials in Parameter Store)

### 5. Deploy Frontend

```powershell
# Build and deploy frontend to S3/CloudFront
.\deploy-all.ps1 `
  -AwsProfile your-profile `
  -AwsRegion us-east-1 `
  -Bucket helixai-site-helixai-live `
  -DistId YOUR_CLOUDFRONT_DIST_ID `
  -WebApiBase https://api.helixai.live `
  -SkipDockerBuild
```

### 6. Verify Deployment

1. **Test API health:**
   ```powershell
   curl https://api.helixai.live/health
   # Should return: {"ok":true}
   ```

2. **Test admin login:**
   - Navigate to https://helixai.live
   - Login with admin credentials
   - Verify you can create personas and chat

3. **Test avatar upload:**
   - Create a persona
   - Upload an avatar
   - Verify image appears in chat

## Environment Variables Reference

### Lambda Function Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `NODE_ENV` | Set to `production` | Terraform |
| `USE_AWS_SECRETS` | Enable Parameter Store loading | Terraform |
| `PARAMETER_PREFIX` | Parameter Store path prefix | Terraform |
| `S3_AVATAR_BUCKET` | Avatar storage bucket | Terraform |
| `AWS_REGION` | AWS region | Terraform |
| `ALLOWED_ORIGINS` | CORS allowed origins | Terraform |
| `SECRETS_NAME` | Secrets Manager secret name | Terraform |
| `OPENAI_API_KEY` | OpenAI API key | Parameter Store |
| `ANTHROPIC_API_KEY` | Anthropic API key | Parameter Store |
| `ADMIN_EMAIL` | Admin user email | Parameter Store |
| `ADMIN_PASSWORD` | Admin user password | Parameter Store |

### Frontend Build Variables

| Variable | Description | Set By |
|----------|-------------|--------|
| `VITE_API_URL` | API base URL | deploy-all.ps1 |

## Updating the Application

### Update API Code

```powershell
# Rebuild and redeploy API
.\deploy-all.ps1 -EcrAccountId YOUR_ID -EcrApiRepo helixai-api -SkipWebBuild
```

### Update Frontend Code

```powershell
# Rebuild and redeploy frontend
.\deploy-all.ps1 -SkipDockerBuild -SkipEcrPush
```

### Run New Database Migrations

```powershell
# After adding migrations locally, deploy them
.\deploy-db-setup.ps1 -AwsProfile your-profile
```

## Troubleshooting

### API Gateway 502 Errors

Check Lambda logs:
```powershell
aws logs tail /aws/lambda/helixai-api --follow
```

Common issues:
- Database connection failure (check DATABASE_URL in Secrets Manager)
- Missing API keys (check Parameter Store)
- Container image not updated (redeploy API)

### CORS Errors

Ensure `ALLOWED_ORIGINS` in Lambda matches your frontend URL:
```powershell
aws lambda get-function-configuration --function-name helixai-api --query 'Environment.Variables.ALLOWED_ORIGINS'
```

### Avatar Upload Failures

1. Check S3 bucket exists: `aws s3 ls s3://helixai-avatars`
2. Verify Lambda has S3 write permissions (check IAM role)
3. Check `S3_AVATAR_BUCKET` environment variable in Lambda

### Database Connection Issues

1. Verify RDS is publicly accessible (for migration scripts)
2. Check security group allows connections on port 5432
3. Verify DATABASE_URL in Secrets Manager is correct

## Cost Optimization

### Development/Testing
- Use `db.t3.micro` for RDS (included in free tier)
- Lambda: 1GB memory, cold starts acceptable
- CloudFront: PriceClass_100 (US, Canada, Europe)

### Production
- Scale RDS instance class based on load
- Increase Lambda memory to 2048MB for faster cold starts
- Enable CloudFront caching (already configured)
- Consider Aurora Serverless for database

## Security Checklist

- ✅ JWT secret is unique and secure
- ✅ Database password is strong
- ✅ RDS security group restricts access (TODO: lock down to Lambda)
- ✅ S3 avatar bucket allows public read, but write is restricted to Lambda
- ✅ All secrets in Secrets Manager/Parameter Store (not in code)
- ✅ CORS properly configured
- ✅ HTTPS enforced via CloudFront and API Gateway

## Rollback Procedure

If deployment fails:

1. **Rollback API:**
   ```powershell
   # Re-tag previous working image
   docker pull YOUR_ECR_REPO:previous-tag
   docker tag YOUR_ECR_REPO:previous-tag YOUR_ECR_REPO:latest
   docker push YOUR_ECR_REPO:latest
   
   # Update Lambda
   aws lambda update-function-code --function-name helixai-api --image-uri YOUR_ECR_REPO:latest
   ```

2. **Rollback Frontend:**
   ```powershell
   # Redeploy previous version from git
   git checkout previous-commit
   .\deploy-all.ps1 -SkipDockerBuild -SkipEcrPush
   ```

3. **Rollback Database:**
   Prisma doesn't support automatic rollback. Manually reverse migrations if needed.

## Next Steps

- Set up CloudWatch alarms for Lambda errors
- Configure RDS backups and retention
- Enable CloudFront access logs
- Set up AWS WAF for API Gateway
- Configure budget alerts
- Set up CI/CD pipeline (GitHub Actions)
