<#
.SYNOPSIS
  Run Prisma migrations and seed the database for AWS deployment.

.DESCRIPTION
  This script:
  1. Runs Prisma migrations against the RDS database
  2. Seeds the database with default engines
  3. Creates admin user if ADMIN_EMAIL and ADMIN_PASSWORD are in Parameter Store
  
  Expects DATABASE_URL to be available (either via env var or pulled from Secrets Manager/Parameter Store)

.EXAMPLE
  # Run migrations and seed
  .\deploy-db-setup.ps1 -AwsProfile my-profile -AwsRegion us-east-1 -DatabaseUrl "postgresql://user:pass@host:5432/dbname"
#>

param(
  [string]$AwsProfile = '',
  [string]$AwsRegion  = 'us-east-1',
  [string]$DatabaseUrl = '',
  [string]$ParameterPrefix = '/helix/prod'
)

$ErrorActionPreference = 'Stop'

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
Write-Host "  Helix Database Setup for AWS"
Write-Host "═══════════════════════════════════════════════════════"

# If DATABASE_URL not provided, try to get from Secrets Manager
if (-not $DatabaseUrl) {
  Write-Host "`nFetching DATABASE_URL from Secrets Manager..."
  
  try {
    $secretJson = & $awsCmd @awsCommonArgs secretsmanager get-secret-value `
      --secret-id helixai-secrets `
      --query 'SecretString' `
      --output text
    
    $secrets = $secretJson | ConvertFrom-Json
    $DatabaseUrl = $secrets.DATABASE_URL
    
    if ($DatabaseUrl) {
      Write-Host "✓ Retrieved DATABASE_URL from Secrets Manager"
    } else {
      throw "DATABASE_URL not found in secret"
    }
  } catch {
    Write-Host "✗ Failed to retrieve DATABASE_URL from Secrets Manager: $_"
    Write-Host ""
    Write-Host "Please provide DATABASE_URL via -DatabaseUrl parameter or ensure it's in Secrets Manager"
    exit 1
  }
}

# Set DATABASE_URL for Prisma
$env:DATABASE_URL = $DatabaseUrl

Write-Host "`n1. Running Prisma migrations..."
Write-Host "───────────────────────────────────────────────────────"

Push-Location apps/api

try {
  # Run migrations
  npx prisma migrate deploy
  
  if ($LASTEXITCODE -ne 0) {
    throw "Prisma migrate failed with exit code $LASTEXITCODE"
  }
  
  Write-Host "✓ Migrations completed successfully"
  
  Write-Host "`n2. Seeding database with engines..."
  Write-Host "───────────────────────────────────────────────────────"
  
  # Run seed script
  npx tsx prisma/seed.ts
  
  if ($LASTEXITCODE -ne 0) {
    throw "Database seeding failed with exit code $LASTEXITCODE"
  }
  
  Write-Host "✓ Database seeded successfully"
  
  Write-Host "`n3. Creating admin user (if credentials in Parameter Store)..."
  Write-Host "───────────────────────────────────────────────────────"
  
  # Try to get admin credentials from Parameter Store
  try {
    $adminEmail = & $awsCmd @awsCommonArgs ssm get-parameter `
      --name "$ParameterPrefix/ADMIN_EMAIL" `
      --query 'Parameter.Value' `
      --output text 2>$null
    
    $adminPassword = & $awsCmd @awsCommonArgs ssm get-parameter `
      --name "$ParameterPrefix/ADMIN_PASSWORD" `
      --with-decryption `
      --query 'Parameter.Value' `
      --output text 2>$null
    
    if ($adminEmail -and $adminPassword) {
      Write-Host "Found admin credentials in Parameter Store"
      Write-Host "Email: $adminEmail"
      
      # Run ensureAdmin script
      $env:ADMIN_EMAIL = $adminEmail
      $env:ADMIN_PASSWORD = $adminPassword
      
      npx tsx scripts/ensureAdmin.ts
      
      if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Admin user created/verified successfully"
      } else {
        Write-Host "⚠ Admin user creation had issues (may already exist)"
      }
    } else {
      Write-Host "⊘ Admin credentials not found in Parameter Store"
      Write-Host "  You can add them later using setup-aws-secrets.ps1"
    }
  } catch {
    Write-Host "⊘ Could not retrieve admin credentials: $_"
    Write-Host "  Skipping admin user creation"
  }
  
  Write-Host ""
  Write-Host "═══════════════════════════════════════════════════════"
  Write-Host "  ✓ Database setup complete!"
  Write-Host "═══════════════════════════════════════════════════════"
  
} catch {
  Write-Host ""
  Write-Host "✗ Error during database setup: $_"
  exit 1
} finally {
  Pop-Location
}
