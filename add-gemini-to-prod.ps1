<#
.SYNOPSIS
  Add Gemini engines to the production database

.DESCRIPTION
  This script connects to the production database and adds Google Gemini models.
  Requires DATABASE_URL to be set (either in .env or passed via AWS Secrets Manager).

.EXAMPLE
  # Get DATABASE_URL from AWS and run the script
  .\add-gemini-to-prod.ps1 -Profile default -Region us-east-1

.EXAMPLE
  # Use local .env DATABASE_URL
  .\add-gemini-to-prod.ps1 -UseLocalEnv
#>

param(
  [string]$Profile = '',
  [string]$Region = 'us-east-1',
  [string]$ParameterPrefix = '/helix/prod',
  [switch]$UseLocalEnv
)

$ErrorActionPreference = 'Stop'

function New-AwsArgs {
  param($p, $r)
  $arr = @()
  if ($p) { $arr += @('--profile', $p) }
  if ($r) { $arr += @('--region', $r) }
  return ,$arr
}

Write-Host "=== Adding Gemini Engines to Production ===" -ForegroundColor Cyan
Write-Host ""

if (-not $UseLocalEnv) {
  $awsArgs = New-AwsArgs $Profile $Region
  
  Write-Host "Fetching DATABASE_URL from AWS Parameter Store..." -ForegroundColor Yellow
  try {
    $databaseUrl = aws ssm get-parameter `
      @awsArgs `
      --name "$ParameterPrefix/DATABASE_URL" `
      --with-decryption `
      --query 'Parameter.Value' `
      --output text 2>&1
    
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to retrieve DATABASE_URL"
    }
    
    $env:DATABASE_URL = $databaseUrl
    Write-Host "✓ DATABASE_URL retrieved" -ForegroundColor Green
  } catch {
    Write-Host "✗ Failed to get DATABASE_URL: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "You can also run with -UseLocalEnv to use .env file" -ForegroundColor Yellow
    exit 1
  }
} else {
  Write-Host "Using DATABASE_URL from local .env file" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Running add-gemini-engines script..." -ForegroundColor Yellow

try {
  Push-Location "apps/api"
  pnpm tsx scripts/add-gemini-engines.ts
  
  if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Success ===" -ForegroundColor Green
    Write-Host "Gemini engines have been added to the database." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "1. Set GEMINI_API_KEY in AWS Parameter Store" -ForegroundColor Gray
    Write-Host "   aws ssm put-parameter --name /helix/prod/GEMINI_API_KEY --value 'your_key' --type SecureString --region us-east-1 --overwrite" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Redeploy the API Lambda to pick up Gemini support" -ForegroundColor Gray
    Write-Host "   .\redeploy-api-lambda.ps1 -AwsRegion us-east-1" -ForegroundColor Gray
  } else {
    throw "Script failed with exit code $LASTEXITCODE"
  }
} catch {
  Write-Host ""
  Write-Host "✗ Error adding Gemini engines: $_" -ForegroundColor Red
  exit 1
} finally {
  Pop-Location
}
