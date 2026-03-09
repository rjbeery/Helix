param(
  [string]$Profile = '',
  [string]$Region = 'us-east-1',
  [string]$ParameterPrefix = '/helix/prod'
)

$ErrorActionPreference = 'Stop'

function New-AwsArgs {
  param($p, $r)
  $arr = @()
  if ($p) { $arr += @('--profile', $p) }
  if ($r) { $arr += @('--region', $r) }
  return ,$arr
}

$awsArgs = New-AwsArgs $Profile $Region

Write-Host "Fetching DATABASE_URL from SSM..."
$databaseUrl = aws ssm get-parameter @awsArgs --name "$ParameterPrefix/DATABASE_URL" --with-decryption --query 'Parameter.Value' --output text
if (-not $databaseUrl) { throw 'DATABASE_URL was empty' }

$env:DATABASE_URL = $databaseUrl

Push-Location "apps/api"
try {
  pnpm tsx scripts/simplify-engines.ts
  if ($LASTEXITCODE -ne 0) { throw "simplify-engines.ts failed ($LASTEXITCODE)" }
}
finally {
  Pop-Location
}

Write-Host "Engine catalog simplified successfully."
