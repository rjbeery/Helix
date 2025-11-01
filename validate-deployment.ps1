<#
.SYNOPSIS
  Pre-deployment validation for Helix AWS deployment

.DESCRIPTION
  Checks that all prerequisites are met before deploying to AWS:
  - AWS CLI configured
  - Docker running
  - Terraform available
  - Required AWS resources exist
  - Secrets are configured
#>

param(
  [string]$AwsProfile = '',
  [string]$AwsRegion  = 'us-east-1'
)

$ErrorActionPreference = 'Continue'

function New-AwsCommonArgs { 
  param($p, $r) 
  $arr = @()
  if ($p) { $arr += @('--profile', $p) }
  if ($r) { $arr += @('--region', $r) }
  return ,$arr 
}

$awsCmd = 'aws'
$awsCommonArgs = New-AwsCommonArgs $AwsProfile $AwsRegion

Write-Host "═══════════════════════════════════════════════════════"
Write-Host "  Helix AWS Deployment Validation"
Write-Host "═══════════════════════════════════════════════════════"
Write-Host ""

$checks = @()

# Check AWS CLI
Write-Host "Checking prerequisites..." -NoNewline
try {
  $null = & $awsCmd --version 2>&1
  if ($LASTEXITCODE -eq 0) {
    $checks += @{Name="AWS CLI"; Status="✓"; Message="Installed"}
  } else {
    $checks += @{Name="AWS CLI"; Status="✗"; Message="Not found"}
  }
} catch {
  $checks += @{Name="AWS CLI"; Status="✗"; Message="Not found"}
}

# Check Docker
try {
  $null = docker --version 2>&1
  if ($LASTEXITCODE -eq 0) {
    $checks += @{Name="Docker"; Status="✓"; Message="Installed"}
  } else {
    $checks += @{Name="Docker"; Status="✗"; Message="Not found"}
  }
} catch {
  $checks += @{Name="Docker"; Status="✗"; Message="Not found"}
}

# Check Terraform
try {
  $null = terraform --version 2>&1
  if ($LASTEXITCODE -eq 0) {
    $checks += @{Name="Terraform"; Status="✓"; Message="Installed"}
  } else {
    $checks += @{Name="Terraform"; Status="✗"; Message="Not found"}
  }
} catch {
  $checks += @{Name="Terraform"; Status="✗"; Message="Not found"}
}

# Check pnpm
try {
  $null = pnpm --version 2>&1
  if ($LASTEXITCODE -eq 0) {
    $checks += @{Name="pnpm"; Status="✓"; Message="Installed"}
  } else {
    $checks += @{Name="pnpm"; Status="✗"; Message="Not found"}
  }
} catch {
  $checks += @{Name="pnpm"; Status="✗"; Message="Not found"}
}

Write-Host " Done"
Write-Host ""

# Check AWS resources
Write-Host "Checking AWS resources..." -NoNewline

# Check ECR repo
try {
  $ecrRepo = & $awsCmd @awsCommonArgs ecr describe-repositories --repository-names helixai-api --query 'repositories[0].repositoryUri' --output text 2>$null
  if ($ecrRepo -and $LASTEXITCODE -eq 0) {
    $checks += @{Name="ECR Repository"; Status="✓"; Message=$ecrRepo}
  } else {
    $checks += @{Name="ECR Repository"; Status="⊘"; Message="Not found (run terraform apply)"}
  }
} catch {
  $checks += @{Name="ECR Repository"; Status="⊘"; Message="Not found"}
}

# Check RDS
try {
  $rdsEndpoint = & $awsCmd @awsCommonArgs rds describe-db-instances --db-instance-identifier helixai-postgres --query 'DBInstances[0].Endpoint.Address' --output text 2>$null
  if ($rdsEndpoint -and $LASTEXITCODE -eq 0) {
    $checks += @{Name="RDS Database"; Status="✓"; Message=$rdsEndpoint}
  } else {
    $checks += @{Name="RDS Database"; Status="⊘"; Message="Not found (run terraform apply)"}
  }
} catch {
  $checks += @{Name="RDS Database"; Status="⊘"; Message="Not found"}
}

# Check S3 avatar bucket
try {
  $s3Bucket = & $awsCmd @awsCommonArgs s3 ls s3://helixai-avatars 2>$null
  if ($LASTEXITCODE -eq 0) {
    $checks += @{Name="S3 Avatar Bucket"; Status="✓"; Message="helixai-avatars"}
  } else {
    $checks += @{Name="S3 Avatar Bucket"; Status="⊘"; Message="Not found (run terraform apply)"}
  }
} catch {
  $checks += @{Name="S3 Avatar Bucket"; Status="⊘"; Message="Not found"}
}

# Check Lambda function
try {
  $lambdaArn = & $awsCmd @awsCommonArgs lambda get-function --function-name helixai-api --query 'Configuration.FunctionArn' --output text 2>$null
  if ($lambdaArn -and $LASTEXITCODE -eq 0) {
    $checks += @{Name="Lambda Function"; Status="✓"; Message="helixai-api"}
  } else {
    $checks += @{Name="Lambda Function"; Status="⊘"; Message="Not found (run terraform apply)"}
  }
} catch {
  $checks += @{Name="Lambda Function"; Status="⊘"; Message="Not found"}
}

Write-Host " Done"
Write-Host ""

# Check secrets
Write-Host "Checking secrets configuration..." -NoNewline

# Check Secrets Manager
try {
  $secretValue = & $awsCmd @awsCommonArgs secretsmanager get-secret-value --secret-id helixai-secrets --query 'SecretString' --output text 2>$null
  if ($secretValue -and $LASTEXITCODE -eq 0) {
    $secret = $secretValue | ConvertFrom-Json
    if ($secret.JWT_SECRET -and $secret.JWT_SECRET -ne "REPLACE_ME_WITH_REAL_SECRET") {
      $checks += @{Name="JWT Secret"; Status="✓"; Message="Configured"}
    } else {
      $checks += @{Name="JWT Secret"; Status="⚠"; Message="Not configured (still placeholder)"}
    }
    
    if ($secret.DATABASE_URL) {
      $checks += @{Name="DATABASE_URL"; Status="✓"; Message="Configured"}
    } else {
      $checks += @{Name="DATABASE_URL"; Status="⚠"; Message="Not found in secret"}
    }
  } else {
    $checks += @{Name="Secrets Manager"; Status="⊘"; Message="Secret not found"}
  }
} catch {
  $checks += @{Name="Secrets Manager"; Status="⊘"; Message="Cannot access"}
}

# Check Parameter Store for admin creds
try {
  $adminEmail = & $awsCmd @awsCommonArgs ssm get-parameter --name /helix/prod/ADMIN_EMAIL --query 'Parameter.Value' --output text 2>$null
  if ($adminEmail -and $LASTEXITCODE -eq 0) {
    $checks += @{Name="Admin Email"; Status="✓"; Message=$adminEmail}
  } else {
    $checks += @{Name="Admin Email"; Status="⊘"; Message="Not in Parameter Store"}
  }
} catch {
  $checks += @{Name="Admin Email"; Status="⊘"; Message="Not configured"}
}

# Check for API keys
try {
  $openaiKey = & $awsCmd @awsCommonArgs ssm get-parameter --name /helix/prod/OPENAI_API_KEY --query 'Parameter.Value' --output text 2>$null
  if ($openaiKey -and $LASTEXITCODE -eq 0) {
    $checks += @{Name="OpenAI API Key"; Status="✓"; Message="Configured"}
  } else {
    $checks += @{Name="OpenAI API Key"; Status="⊘"; Message="Not configured"}
  }
} catch {
  $checks += @{Name="OpenAI API Key"; Status="⊘"; Message="Not configured"}
}

try {
  $anthropicKey = & $awsCmd @awsCommonArgs ssm get-parameter --name /helix/prod/ANTHROPIC_API_KEY --query 'Parameter.Value' --output text 2>$null
  if ($anthropicKey -and $LASTEXITCODE -eq 0) {
    $checks += @{Name="Anthropic API Key"; Status="✓"; Message="Configured"}
  } else {
    $checks += @{Name="Anthropic API Key"; Status="⊘"; Message="Not configured"}
  }
} catch {
  $checks += @{Name="Anthropic API Key"; Status="⊘"; Message="Not configured"}
}

Write-Host " Done"
Write-Host ""

# Print results
Write-Host "═══════════════════════════════════════════════════════"
Write-Host "  Validation Results"
Write-Host "═══════════════════════════════════════════════════════"
Write-Host ""

$maxNameLength = ($checks | ForEach-Object { $_.Name.Length } | Measure-Object -Maximum).Maximum + 2

foreach ($check in $checks) {
  $padding = " " * ($maxNameLength - $check.Name.Length)
  Write-Host "$($check.Status) $($check.Name)$padding : $($check.Message)"
}

Write-Host ""

# Summary
$passed = ($checks | Where-Object { $_.Status -eq "✓" }).Count
$warnings = ($checks | Where-Object { $_.Status -eq "⚠" }).Count
$failed = ($checks | Where-Object { $_.Status -eq "✗" }).Count
$missing = ($checks | Where-Object { $_.Status -eq "⊘" }).Count

Write-Host "Summary: $passed passed, $warnings warnings, $failed failed, $missing not configured"
Write-Host ""

if ($failed -gt 0) {
  Write-Host "✗ Critical prerequisites missing. Please install required tools."
  exit 1
} elseif ($missing -gt 3) {
  Write-Host "⚠ AWS resources not deployed. Run 'terraform apply' in infra/terraform/"
  Write-Host ""
  Write-Host "Next steps:"
  Write-Host "  1. cd infra/terraform"
  Write-Host "  2. terraform init"
  Write-Host "  3. terraform apply -var='db_master_password=YOUR_PASSWORD'"
} elseif ($warnings -gt 0) {
  Write-Host "⚠ Some secrets need configuration. Run setup-aws-secrets.ps1"
  Write-Host ""
  Write-Host "Next steps:"
  Write-Host "  1. Update JWT secret in Secrets Manager"
  Write-Host "  2. Run: .\setup-aws-secrets.ps1 -AwsProfile $AwsProfile -AwsRegion $AwsRegion"
} else {
  Write-Host "✓ All checks passed! Ready to deploy."
  Write-Host ""
  Write-Host "Next steps:"
  Write-Host "  1. Deploy API: .\deploy-all.ps1 -EcrAccountId YOUR_ID -EcrApiRepo helixai-api"
  Write-Host "  2. Setup DB: .\deploy-db-setup.ps1"
  Write-Host "  3. Deploy frontend: .\deploy-all.ps1 -SkipDockerBuild -SkipEcrPush"
}
