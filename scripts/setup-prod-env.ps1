# Fetches production DATABASE_URL from AWS SSM Parameter Store and writes to .env
# This enables scripts like add-user.ps1 to work against production without manual parameter passing
#
# Usage:
#   ./scripts/setup-prod-env.ps1
#
# Requirements:
#   - AWS CLI installed and configured
#   - AWS credentials with SSM access
#
# This creates/updates .env in the repo root with DATABASE_URL

[CmdletBinding()]
Param()

try {
  Write-Host "==> Fetching production DATABASE_URL from AWS Parameter Store..." -ForegroundColor Cyan
  
  # Get the parameter from SSM
  $param = aws ssm get-parameter --name "/helix/prod/DATABASE_URL" --with-decryption --query "Parameter.Value" --output text 2>&1
  
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to fetch parameter from SSM. Error: $param"
  }
  
  if ([string]::IsNullOrWhiteSpace($param)) {
    throw "Parameter returned empty value"
  }
  
  # Write to .env file in repo root
  $envPath = Join-Path (git rev-parse --show-toplevel) ".env"
  
  # Preserve any existing values other than DATABASE_URL
  $envContent = @()
  if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
      if (-not $_.StartsWith("DATABASE_URL")) {
        $envContent += $_
      }
    }
  }
  
  # Add the new DATABASE_URL
  $envContent += "DATABASE_URL=$param"
  
  # Write back
  $envContent | Set-Content $envPath -Encoding UTF8
  
  Write-Host "✔ Production DATABASE_URL saved to .env" -ForegroundColor Green
  Write-Host "  Location: $envPath" -ForegroundColor DarkGray
  Write-Host "  (This file is git-ignored and will not be committed)" -ForegroundColor DarkGray
}
catch {
  Write-Error $_
  exit 1
}
