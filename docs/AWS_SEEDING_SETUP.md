# AWS Database Seeding - Secure Setup Guide

## Overview
This guide explains how to securely seed your database and create admin users in AWS without exposing credentials in your repository.

**Your Architecture**: Lambda (container image from ECR) + API Gateway + RDS PostgreSQL

## Approach: AWS Systems Manager Parameter Store + Lambda

### 1. Store Secrets in AWS Parameter Store (Recommended)

AWS Systems Manager Parameter Store provides secure, encrypted storage for secrets that Lambda can access at runtime.

#### Store Admin Credentials (One-Time Setup):
```bash
# Set your AWS profile and region
$profile = "your-aws-profile"
$region = "us-east-1"

# Store admin email (SecureString encrypts at rest)
aws ssm put-parameter `
  --profile $profile `
  --region $region `
  --name "/helix/prod/ADMIN_EMAIL" `
  --value "rjbeery@gmail.com" `
  --type "SecureString" `
  --description "Helix admin email"

# Store admin password (SecureString encrypts at rest)
aws ssm put-parameter `
  --profile $profile `
  --region $region `
  --name "/helix/prod/ADMIN_PASSWORD" `
  --value "Helix56789!" `
  --type "SecureString" `
  --description "Helix admin password"
```

### 2. Grant Lambda IAM Permission to Read Parameters

Your Lambda function needs IAM permissions to read from Parameter Store. Add this to your Terraform or IAM role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": [
        "arn:aws:ssm:us-east-1:YOUR_ACCOUNT_ID:parameter/helix/prod/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": [
        "arn:aws:kms:us-east-1:YOUR_ACCOUNT_ID:key/aws/ssm"
      ]
    }
  ]
}
```

### 3. Update Lambda Configuration

Add environment variable to tell the app to read from Parameter Store:

```bash
aws lambda update-function-configuration `
  --profile $profile `
  --region $region `
  --function-name helixai-api `
  --environment "Variables={USE_AWS_SECRETS=true,PARAMETER_PREFIX=/helix/prod}"
```

### 4. Update secrets.ts to Read from Parameter Store

The config/secrets.ts file should be modified to fetch from Parameter Store when in AWS.

### 5. Run Database Migrations and Seeding

#### Option A: Manual one-time execution via AWS CLI
```bash
# Connect to your RDS instance and run migrations
# (Requires bastion host or VPC connection)

# Or invoke a custom Lambda function that runs migrations
aws lambda invoke `
  --profile $profile `
  --region $region `
  --function-name helixai-db-migrate `
  --payload '{"action": "migrate"}' `
  response.json
```

#### Option B: Automated on Lambda cold start
Add a startup check in your Lambda handler to run migrations if needed (see implementation below).

---

## Alternative Approach: AWS Secrets Manager (More Features, Costs More)

AWS Secrets Manager provides automatic rotation and versioning but costs more than Parameter Store.

```bash
# Create secret with both credentials
aws secretsmanager create-secret `
  --profile $profile `
  --region $region `
  --name helix/prod/admin-credentials `
  --description "Helix admin user credentials" `
  --secret-string '{\"email\":\"rjbeery@gmail.com\",\"password\":\"Helix56789!\"}'
```

Then update IAM to allow `secretsmanager:GetSecretValue`.

---

## Alternative Approach: Environment Variables (Simple but Less Secure)

For development or if you control the Lambda console access tightly:

```bash
aws lambda update-function-configuration `
  --profile $profile `
  --region $region `
  --function-name helixai-api `
  --environment "Variables={ADMIN_EMAIL=rjbeery@gmail.com,ADMIN_PASSWORD=Helix56789!,NODE_ENV=production}"
```

⚠️ **Note**: Environment variables are visible in the Lambda console to anyone with access, so Parameter Store or Secrets Manager are preferred.

---

## Implementation: Database Migrations on Deploy

Create a dedicated migration script that runs automatically:

### Option 1: Lambda Warm-Up Hook
Run migrations on first request after deploy (adds ~2-5s to first request).

### Option 2: Separate Migration Lambda
Create a one-off Lambda that you invoke after deploy to run migrations and seeding.

### Option 3: ECS Task or Fargate
Run migrations as a pre-deployment step using ECS task or Fargate container.

---

## Security Best Practices

1. ✅ **Never commit credentials** - Use Parameter Store, Secrets Manager, or environment variables
2. ✅ **Use IAM roles** - Lambda uses execution role to access secrets, no hardcoded keys
3. ✅ **Encrypt at rest** - Parameter Store SecureString uses KMS encryption
4. ✅ **Limit access** - Use least-privilege IAM policies
5. ✅ **Audit access** - CloudTrail logs all parameter access
6. ✅ **Rotate regularly** - Update passwords in Parameter Store, app fetches new values

---

## Quick Start Commands

### After deploying your Lambda:
```powershell
# 1. Store secrets (one-time)
aws ssm put-parameter --name "/helix/prod/ADMIN_EMAIL" --value "rjbeery@gmail.com" --type "SecureString" --profile $profile --region $region
aws ssm put-parameter --name "/helix/prod/ADMIN_PASSWORD" --value "Helix56789!" --type "SecureString" --profile $profile --region $region

# 2. Update Lambda to use secrets
aws lambda update-function-configuration --function-name helixai-api --environment "Variables={USE_AWS_SECRETS=true}" --profile $profile --region $region

# 3. Invoke migration (if you create a migration Lambda)
aws lambda invoke --function-name helixai-db-migrate --payload '{"action":"seed"}' response.json --profile $profile --region $region
```

---

## Notes

- **Database Seeding (engines)**: Can run automatically on Lambda initialization since it uses `upsert` (safe to run multiple times)
- **Admin User Creation**: Should run once, preferably via a separate invocation or manual script
- **Migrations**: Should run via Prisma migrate in a controlled way (not on every Lambda invocation)
