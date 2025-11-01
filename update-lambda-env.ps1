<#
.SYNOPSIS
  Update Lambda function environment variables with API keys from Parameter Store

.DESCRIPTION
  Fetches API keys from Parameter Store and updates Lambda function environment variables.
  Preserves existing environment variables while adding/updating API keys.

.EXAMPLE
  .\update-lambda-env.ps1 -AwsProfile my-profile -AwsRegion us-east-1
#>

param(
  [string]$AwsProfile = '',
  [string]$AwsRegion  = 'us-east-1',
  [string]$LambdaFunctionName = 'helixai-api',
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
Write-Host "  Update Lambda Environment Variables"
Write-Host "═══════════════════════════════════════════════════════"
Write-Host ""

try {
  # Get current Lambda environment
  Write-Host "Fetching current Lambda environment..."
  $currentEnvJson = & $awsCmd @awsCommonArgs lambda get-function-configuration `
    --function-name $LambdaFunctionName `
    --query 'Environment.Variables' `
    --output json
  
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to get Lambda configuration"
  }
  
  $currentEnv = $currentEnvJson | ConvertFrom-Json
  $envVars = @{}
  
  # Copy existing environment variables
  $currentEnv.PSObject.Properties | ForEach-Object {
    $envVars[$_.Name] = $_.Value
  }
  
  Write-Host "✓ Current environment has $($envVars.Count) variables"
  Write-Host ""
  
  # Fetch API keys from Parameter Store
  Write-Host "Fetching API keys from Parameter Store..."
  
  $apiKeys = @(
    @{Name='OPENAI_API_KEY'; Required=$false},
    @{Name='ANTHROPIC_API_KEY'; Required=$false},
    @{Name='ADMIN_EMAIL'; Required=$false},
    @{Name='ADMIN_PASSWORD'; Required=$false}
  )
  
  foreach ($key in $apiKeys) {
    $paramName = "$ParameterPrefix/$($key.Name)"
    
    try {
      $value = & $awsCmd @awsCommonArgs ssm get-parameter `
        --name $paramName `
        --with-decryption `
        --query 'Parameter.Value' `
        --output text 2>$null
      
      if ($LASTEXITCODE -eq 0 -and $value) {
        $envVars[$key.Name] = $value
        
        # Mask sensitive values in output
        if ($key.Name -like '*KEY' -or $key.Name -like '*PASSWORD') {
          $masked = $value.Substring(0, [Math]::Min(8, $value.Length)) + "***"
          Write-Host "  ✓ $($key.Name): $masked"
        } else {
          Write-Host "  ✓ $($key.Name): $value"
        }
      } else {
        if ($key.Required) {
          throw "$($key.Name) is required but not found in Parameter Store"
        } else {
          Write-Host "  ⊘ $($key.Name): Not found (optional)"
        }
      }
    } catch {
      if ($key.Required) {
        throw "Failed to fetch $($key.Name): $_"
      } else {
        Write-Host "  ⊘ $($key.Name): Not available"
      }
    }
  }
  
  Write-Host ""
  Write-Host "Updating Lambda function environment..."
  
  # Convert to JSON for AWS CLI
  $envJson = $envVars | ConvertTo-Json -Compress
  
  # Update Lambda
  $updateResult = & $awsCmd @awsCommonArgs lambda update-function-configuration `
    --function-name $LambdaFunctionName `
    --environment "Variables=$envJson" `
    --output json
  
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to update Lambda configuration"
  }
  
  Write-Host "✓ Lambda environment updated successfully"
  Write-Host ""
  Write-Host "═══════════════════════════════════════════════════════"
  Write-Host "  ✓ Update complete!"
  Write-Host "═══════════════════════════════════════════════════════"
  
} catch {
  Write-Host ""
  Write-Host "✗ Error: $_"
  exit 1
}
