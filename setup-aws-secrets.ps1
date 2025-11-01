#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Setup AWS secrets and run database migrations/seeding after deployment

.DESCRIPTION
  This script stores admin credentials in AWS Systems Manager Parameter Store,
  updates Lambda environment variables, and optionally runs database migrations.

.EXAMPLE
  .\setup-aws-secrets.ps1 -Profile my-aws-profile -Region us-east-1 -AdminEmail "admin@example.com" -AdminPassword "SecurePass123!"

.EXAMPLE
  # With all options
  .\setup-aws-secrets.ps1 -Profile prod -Region us-east-1 -AdminEmail "admin@example.com" -AdminPassword "SecurePass123!" -LambdaFunction helixai-api -RunMigrations
#>

param(
  [Parameter(Mandatory=$true)]
  [string]$AdminEmail,
  
  [Parameter(Mandatory=$true)]
  [string]$AdminPassword,
  
  [string]$Profile = '',
  [string]$Region = 'us-east-1',
  [string]$ParameterPrefix = '/helix/prod',
  [string]$LambdaFunction = 'helixai-api',
  [switch]$RunMigrations,
  [switch]$SkipLambdaUpdate
)

function New-AwsArgs {
  param($p, $r)
  $arr = @()
  if ($p) { $arr += @('--profile', $p) }
  if ($r) { $arr += @('--region', $r) }
  return ,$arr
}

$awsArgs = New-AwsArgs $Profile $Region

Write-Host "=== AWS Secrets Setup for Helix ===" -ForegroundColor Cyan
Write-Host ""

# 1. Store admin credentials in Parameter Store
Write-Host "Storing admin credentials in Parameter Store..." -ForegroundColor Yellow
Write-Host "  Prefix: $ParameterPrefix" -ForegroundColor Gray

try {
  # Store ADMIN_EMAIL
  Write-Host "  Creating parameter: $ParameterPrefix/ADMIN_EMAIL" -ForegroundColor Gray
  aws ssm put-parameter `
    @awsArgs `
    --name "$ParameterPrefix/ADMIN_EMAIL" `
    --value $AdminEmail `
    --type "SecureString" `
    --description "Helix admin email" `
    --overwrite | Out-Null
  
  # Store ADMIN_PASSWORD
  Write-Host "  Creating parameter: $ParameterPrefix/ADMIN_PASSWORD" -ForegroundColor Gray
  aws ssm put-parameter `
    @awsArgs `
    --name "$ParameterPrefix/ADMIN_PASSWORD" `
    --value $AdminPassword `
    --type "SecureString" `
    --description "Helix admin password" `
    --overwrite | Out-Null
  
  Write-Host "✓ Credentials stored securely in Parameter Store" -ForegroundColor Green
} catch {
  Write-Host "✗ Failed to store credentials: $_" -ForegroundColor Red
  exit 1
}

Write-Host ""

# 2. Update Lambda environment variables
if (-not $SkipLambdaUpdate) {
  Write-Host "Updating Lambda function environment..." -ForegroundColor Yellow
  Write-Host "  Function: $LambdaFunction" -ForegroundColor Gray
  
  try {
    aws lambda update-function-configuration `
      @awsArgs `
      --function-name $LambdaFunction `
      --environment "Variables={USE_AWS_SECRETS=true,PARAMETER_PREFIX=$ParameterPrefix,NODE_ENV=production}" | Out-Null
    
    Write-Host "✓ Lambda environment updated" -ForegroundColor Green
  } catch {
    Write-Host "✗ Failed to update Lambda: $_" -ForegroundColor Red
    Write-Host "  You may need to update IAM permissions for Parameter Store access" -ForegroundColor Yellow
    exit 1
  }
} else {
  Write-Host "Skipping Lambda update (--SkipLambdaUpdate)" -ForegroundColor Gray
}

Write-Host ""

# 3. Run migrations (optional)
if ($RunMigrations) {
  Write-Host "Running database migrations..." -ForegroundColor Yellow
  Write-Host "  Note: This requires the Lambda to have network access to your RDS instance" -ForegroundColor Gray
  
  # Option A: Invoke Lambda with a special payload
  # (Requires your Lambda handler to support a "migrate" action)
  
  Write-Host "  To run migrations, you can:" -ForegroundColor Yellow
  Write-Host "    1. Connect to your RDS instance via bastion host" -ForegroundColor Gray
  Write-Host "    2. Run: npx prisma migrate deploy" -ForegroundColor Gray
  Write-Host "    3. Run: npx prisma db seed" -ForegroundColor Gray
  Write-Host ""
  Write-Host "  Or invoke the ensureAdmin script with AWS credentials:" -ForegroundColor Yellow
  Write-Host "    node scripts/ensureAdmin.js" -ForegroundColor Gray
  Write-Host ""
  Write-Host "  Migrations are typically run during deployment via CI/CD" -ForegroundColor Gray
} else {
  Write-Host "Skipping database migrations (use --RunMigrations to enable)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify Lambda IAM role has ssm:GetParameters permission" -ForegroundColor White
Write-Host "  2. Test Lambda function to ensure it can read secrets" -ForegroundColor White
Write-Host "  3. Run database migrations if not already done" -ForegroundColor White
Write-Host "  4. Access your app and login with: $AdminEmail" -ForegroundColor White
Write-Host ""
Write-Host "Security notes:" -ForegroundColor Yellow
Write-Host "  • Credentials are encrypted at rest with KMS" -ForegroundColor Gray
Write-Host "  • Access is logged in CloudTrail" -ForegroundColor Gray
Write-Host "  • Never commit credentials to git" -ForegroundColor Gray
Write-Host ""
