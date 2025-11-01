# Quick Start: Deploy Helix to AWS

## Prerequisites Check

Run this first to verify your environment:
```powershell
.\validate-deployment.ps1 -AwsProfile your-profile -AwsRegion us-east-1
```

## First-Time Setup (Step by Step)

### 1. Deploy Infrastructure (~5 minutes)

```powershell
cd infra/terraform
terraform init
terraform apply -var="db_master_password=YOUR_SECURE_DB_PASSWORD"
```

**Save these outputs:**
- ECR repository URL
- RDS endpoint
- CloudFront distribution ID
- S3 bucket name

### 2. Configure Secrets (~2 minutes)

#### Update JWT Secret
```powershell
# Generate random JWT secret
$jwt = -join ((65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Get DATABASE_URL from Terraform output
$dbUrl = "postgresql://postgres:YOUR_DB_PASSWORD@RDS_ENDPOINT:5432/helix?schema=public"

# Update secret
aws secretsmanager put-secret-value `
  --secret-id helixai-secrets `
  --secret-string "{\"JWT_SECRET\":\"$jwt\",\"DATABASE_URL\":\"$dbUrl\"}"
```

#### Add Admin Credentials and API Keys
```powershell
.\setup-aws-secrets.ps1 -AwsProfile your-profile -AwsRegion us-east-1

# This will prompt for:
# - Admin email
# - Admin password
# - OpenAI API key (optional)
# - Anthropic API key (optional)
```

### 3. Build and Deploy API (~10 minutes)

```powershell
# Build and push to ECR, then update Lambda
.\deploy-all.ps1 `
  -AwsProfile your-profile `
  -AwsRegion us-east-1 `
  -EcrAccountId YOUR_AWS_ACCOUNT_ID `
  -EcrApiRepo helixai-api `
  -SkipWebBuild
```

### 4. Setup Database (~2 minutes)

```powershell
# Run migrations, seed engines, create admin user
.\deploy-db-setup.ps1 -AwsProfile your-profile -AwsRegion us-east-1
```

### 5. Update Lambda Environment (~1 minute)

```powershell
# Load API keys from Parameter Store into Lambda
.\update-lambda-env.ps1 -AwsProfile your-profile -AwsRegion us-east-1
```

### 6. Deploy Frontend (~3 minutes)

```powershell
.\deploy-all.ps1 `
  -AwsProfile your-profile `
  -AwsRegion us-east-1 `
  -Bucket helixai-site-helixai-live `
  -DistId YOUR_CLOUDFRONT_DIST_ID `
  -WebApiBase https://api.helixai.live `
  -SkipDockerBuild `
  -SkipEcrPush
```

### 7. Test Deployment

```powershell
# Test API
curl https://api.helixai.live/health

# Test frontend
# Open https://helixai.live in browser
# Login with admin credentials
# Create a persona
# Upload an avatar
# Send a message
```

## Ongoing Updates

### Update API Code
```powershell
.\deploy-all.ps1 -EcrAccountId YOUR_ID -EcrApiRepo helixai-api -SkipWebBuild
```

### Update Frontend Code
```powershell
.\deploy-all.ps1 -SkipDockerBuild -SkipEcrPush
```

### Run New Migrations
```powershell
.\deploy-db-setup.ps1 -AwsProfile your-profile
```

### Add/Update API Keys
```powershell
# Add to Parameter Store
aws ssm put-parameter --name /helix/prod/NEW_API_KEY --value "key-value" --type SecureString

# Update Lambda
.\update-lambda-env.ps1 -AwsProfile your-profile
```

## Troubleshooting

| Issue | Command |
|-------|---------|
| Lambda errors | `aws logs tail /aws/lambda/helixai-api --follow` |
| Check Lambda config | `aws lambda get-function-configuration --function-name helixai-api` |
| Test database connection | `psql $DATABASE_URL` |
| Check S3 bucket | `aws s3 ls s3://helixai-avatars` |
| Invalidate CloudFront | `aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"` |

## Cost Estimates

**Development/Free Tier:**
- RDS t3.micro: Free tier eligible (first year)
- Lambda: Free tier includes 1M requests/month
- CloudFront: 1TB data transfer free
- S3: 5GB storage free
- **Estimated monthly cost: $0-5** (mostly RDS after free tier)

**Production:**
- RDS db.t3.small: ~$30/month
- Lambda: ~$10-20/month (depending on usage)
- CloudFront: ~$10-50/month (depending on traffic)
- S3: ~$1-5/month
- **Estimated monthly cost: $51-105**

## Full Documentation

See [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) for complete details, security considerations, and advanced configuration.
