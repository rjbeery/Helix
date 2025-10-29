<#
.SYNOPSIS
  Seed production users (admin and/or a standard user) into a Postgres database using Prisma scripts.

.DESCRIPTION
  Uses apps/api/scripts/ensureAdmin.ts and ensureUser.ts. You must provide a Postgres DATABASE_URL directly
  or specify a Secrets Manager secret that contains either a full DATABASE_URL field or discrete fields
  (host, port, username, password, dbname). The script will not print secrets.

.PARAMETER DatabaseUrl
  Postgres connection string, e.g. postgresql://user:pass@host:5432/db?sslmode=require

.PARAMETER DbSecretId
  AWS Secrets Manager secret name or ARN to resolve database connection (expects DATABASE_URL or fields).

.PARAMETER AwsProfile / AwsRegion
  Optional parameters for AWS CLI when resolving DbSecretId.

.PARAMETER AdminEmail / AdminPassword
  If provided, seeds/updates the admin (role master).

.PARAMETER UserEmail / UserPassword
  If provided, seeds/updates a standard user (role user).

.EXAMPLE
  .\seed-prod.ps1 -DatabaseUrl $env:PROD_DATABASE_URL -AdminEmail admin@yourco.com -AdminPassword 'StrongPass!'

.EXAMPLE
  .\seed-prod.ps1 -DbSecretId arn:aws:secretsmanager:us-east-1:123:secret:my-db -AwsProfile prod -AwsRegion us-east-1 -UserEmail user@yourco.com -UserPassword 'demo1234'
#>

param(
  [string]$DatabaseUrl = '',
  [string]$DbSecretId  = '',
  [string]$AwsProfile  = '',
  [string]$AwsRegion   = '',

  [string]$AdminEmail = '',
  [SecureString]$AdminPassword,
  [string]$UserEmail = '',
  [SecureString]$UserPassword
)

function Resolve-DatabaseUrl {
  param([string]$DbUrl, [string]$SecretId, [string]$AwsProf, [string]$AwsReg)
  if ($DbUrl) { return $DbUrl }
  if (-not $SecretId) { throw "Provide -DatabaseUrl or -DbSecretId" }

  $awsCmd = 'aws'
  $awsArgs = @('secretsmanager','get-secret-value','--secret-id',$SecretId)
  if ($AwsProf) { $awsArgs += @('--profile',$AwsProf) }
  if ($AwsReg)  { $awsArgs += @('--region', $AwsReg) }
  $awsArgs += @('--query','SecretString','--output','text')

  $secret = & $awsCmd @awsArgs
  if (-not $secret) { throw "Secret not found or empty: $SecretId" }
  $obj = $null
  try { $obj = $secret | ConvertFrom-Json } catch { }
  if ($obj -and $obj.DATABASE_URL) { return $obj.DATABASE_URL }
  if ($obj -and $obj.username -and $obj.password -and $obj.host -and $obj.port -and $obj.dbname) {
    $port = [string]$obj.port
    return "postgresql://$($obj.username):$($obj.password)@$($obj.host):$port/$($obj.dbname)?sslmode=require"
  }
  throw "Secret does not contain DATABASE_URL or discrete connection fields."
}

try {
  $db = Resolve-DatabaseUrl -DbUrl $DatabaseUrl -SecretId $DbSecretId -AwsProf $AwsProfile -AwsReg $AwsRegion
  Write-Host "Seeding database (url resolved)."

  Push-Location 'apps/api'
  $env:DATABASE_URL = $db

  # Apply Prisma migrations to ensure schema exists
  Write-Host "Applying Prisma migrations..."
  pnpm prisma migrate deploy

  $seeded = $false
  if ($AdminEmail -and $AdminPassword) {
    $env:ADMIN_EMAIL = $AdminEmail
    $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPassword))
    pnpm tsx scripts/ensureAdmin.ts
    $seeded = $true
  }
  if ($UserEmail -and $UserPassword) {
    $env:FNBO_EMAIL = $UserEmail
    $env:FNBO_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($UserPassword))
    pnpm tsx scripts/ensureUser.ts
    $seeded = $true
  }
  if (-not $seeded) {
    Write-Host "No user parameters provided; nothing to seed. Use -AdminEmail/-AdminPassword and/or -UserEmail/-UserPassword." -ForegroundColor Yellow
  }
  Pop-Location
  Write-Host "Seeding completed."
} catch {
  Write-Error "Seeding failed: $_"
  exit 1
}
