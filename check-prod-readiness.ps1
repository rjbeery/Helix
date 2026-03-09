<#
.SYNOPSIS
  Pre-flight check for production LLM API calls

.DESCRIPTION
  Validates that:
  1. Required API keys are in Parameter Store
  2. Engines are properly seeded in database
  3. Lambda can load secrets
  4. API health endpoint responds

.EXAMPLE
  .\check-prod-readiness.ps1 -AwsProfile default -AwsRegion us-east-1
#>

param(
  [string]$AwsProfile = '',
  [string]$AwsRegion = 'us-east-1',
  [string]$ParameterPrefix = '/helix/prod',
  [string]$LambdaFunctionName = 'helixai-api',
  [string]$ApiUrl = 'https://api.helixai.live'
)

$ErrorActionPreference = 'Continue'

function New-AwsArgs {
  param($p, $r)
  $arr = @()
  if ($p) { $arr += @('--profile', $p) }
  if ($r) { $arr += @('--region', $r) }
  return ,$arr
}

$awsArgs = New-AwsArgs $AwsProfile $AwsRegion
$checks = @()

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Production LLM API Readiness Check"
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check 1: Parameter Store API Keys
Write-Host "[1/5] Checking Parameter Store API keys..." -ForegroundColor Yellow

$requiredKeys = @(
  @{Name='OPENAI_API_KEY'; Required=$false},
  @{Name='ANTHROPIC_API_KEY'; Required=$false},
  @{Name='GEMINI_API_KEY'; Required=$false},
  @{Name='GOOGLE_API_KEY'; Required=$false},
  @{Name='GROK_API_KEY'; Required=$false},
  @{Name='XAI_API_KEY'; Required=$false}
)

$foundKeys = @{}
foreach ($key in $requiredKeys) {
  $paramName = "$ParameterPrefix/$($key.Name)"
  try {
    $value = aws ssm get-parameter @awsArgs --name $paramName --with-decryption --query 'Parameter.Value' --output text 2>$null
    if ($LASTEXITCODE -eq 0 -and $value -and $value.Length -gt 10) {
      $checks += @{Name=$key.Name; Status="✓"; Message="Present ($(($value.Substring(0,10)))...)"}
      $foundKeys[$key.Name] = $true
    } else {
      $checks += @{Name=$key.Name; Status="⊘"; Message="Not configured"}
    }
  } catch {
    $checks += @{Name=$key.Name; Status="⊘"; Message="Not configured"}
  }
}

# Check for aliased keys
$hasOpenAI = $foundKeys['OPENAI_API_KEY']
$hasAnthropic = $foundKeys['ANTHROPIC_API_KEY']
$hasGemini = $foundKeys['GEMINI_API_KEY'] -or $foundKeys['GOOGLE_API_KEY']
$hasGrok = $foundKeys['GROK_API_KEY'] -or $foundKeys['XAI_API_KEY']

Write-Host ""

# Check 2: Lambda Environment Variables
Write-Host "[2/5] Checking Lambda environment configuration..." -ForegroundColor Yellow

try {
  $lambdaConfig = aws lambda get-function-configuration @awsArgs --function-name $LambdaFunctionName 2>&1 | ConvertFrom-Json
  
  if ($lambdaConfig.Environment.Variables.USE_AWS_SECRETS -eq 'true') {
    $checks += @{Name="Lambda USE_AWS_SECRETS"; Status="✓"; Message="Enabled"}
  } else {
    $checks += @{Name="Lambda USE_AWS_SECRETS"; Status="⚠"; Message="Not enabled (will use SECRETS_NAME instead)"}
  }
  
  if ($lambdaConfig.Environment.Variables.PARAMETER_PREFIX) {
    $checks += @{Name="Lambda PARAMETER_PREFIX"; Status="✓"; Message=$lambdaConfig.Environment.Variables.PARAMETER_PREFIX}
  } else {
    $checks += @{Name="Lambda PARAMETER_PREFIX"; Status="⊘"; Message="Not set"}
  }
} catch {
  $checks += @{Name="Lambda Config"; Status="✗"; Message="Failed to retrieve"}
}

Write-Host ""

# Check 3: Database Engines
Write-Host "[3/5] Checking database engines..." -ForegroundColor Yellow

try {
  $databaseUrl = aws ssm get-parameter @awsArgs --name "$ParameterPrefix/DATABASE_URL" --with-decryption --query 'Parameter.Value' --output text 2>$null
  
  if ($LASTEXITCODE -eq 0 -and $databaseUrl) {
    $env:DATABASE_URL = $databaseUrl
    Push-Location "apps\api"
    
    $engines = pnpm tsx scripts/list-enabled-engines.ts 2>$null | ConvertFrom-Json
    
    if ($engines) {
      $byProvider = $engines | Group-Object provider
      
      foreach ($group in $byProvider) {
        $providerName = $group.Name
        $count = $group.Count
        $models = ($group.Group | Select-Object -ExpandProperty displayName) -join ', '
        $checks += @{Name="Engines ($providerName)"; Status="✓"; Message="$count enabled: $models"}
      }
    } else {
      $checks += @{Name="Database Engines"; Status="⚠"; Message="Could not query"}
    }
    
    Pop-Location
  } else {
    $checks += @{Name="Database URL"; Status="✗"; Message="Not found in Parameter Store"}
  }
} catch {
  $checks += @{Name="Database Engines"; Status="⚠"; Message="Failed to check: $_"}
}

Write-Host ""

# Check 4: API Health
Write-Host "[4/5] Checking API health endpoint..." -ForegroundColor Yellow

try {
  $response = Invoke-WebRequest -Uri "$ApiUrl/health" -Method GET -TimeoutSec 10 -ErrorAction Stop
  
  if ($response.StatusCode -eq 200) {
    $checks += @{Name="API Health"; Status="✓"; Message="$ApiUrl/health responding"}
  } else {
    $checks += @{Name="API Health"; Status="⚠"; Message="Status: $($response.StatusCode)"}
  }
} catch {
  $checks += @{Name="API Health"; Status="✗"; Message="Failed: $($_.Exception.Message)"}
}

Write-Host ""

# Check 5: Provider Coverage
Write-Host "[5/5] Analyzing provider coverage..." -ForegroundColor Yellow

$providerCoverage = @{
  'OpenAI' = $hasOpenAI
  'Anthropic' = $hasAnthropic
  'Gemini' = $hasGemini
  'Grok' = $hasGrok
}

foreach ($provider in $providerCoverage.Keys) {
  if ($providerCoverage[$provider]) {
    $checks += @{Name="$provider Ready"; Status="✓"; Message="API key configured"}
  } else {
    $checks += @{Name="$provider Ready"; Status="⚠"; Message="No API key"}
  }
}

Write-Host ""

# Print Results
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Results"
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$maxNameLength = ($checks | ForEach-Object { $_.Name.Length } | Measure-Object -Maximum).Maximum + 2

foreach ($check in $checks) {
  $padding = ' ' * ($maxNameLength - $check.Name.Length)
  
  $statusColor = switch ($check.Status) {
    '✓' { 'Green' }
    '⚠' { 'Yellow' }
    '✗' { 'Red' }
    '⊘' { 'Gray' }
    default { 'White' }
  }
  
  Write-Host "  $($check.Status) " -NoNewline -ForegroundColor $statusColor
  Write-Host "$($check.Name)$padding" -NoNewline -ForegroundColor White
  Write-Host $check.Message -ForegroundColor Gray
}

Write-Host ""

# Summary
$passed = ($checks | Where-Object { $_.Status -eq "✓" }).Count
$warnings = ($checks | Where-Object { $_.Status -eq "⚠" }).Count
$failed = ($checks | Where-Object { $_.Status -eq "✗" }).Count
$missing = ($checks | Where-Object { $_.Status -eq "⊘" }).Count

Write-Host "Summary: $passed passed, $warnings warnings, $failed failed, $missing not configured" -ForegroundColor White
Write-Host ""

if ($failed -gt 0) {
  Write-Host "⚠ Critical issues detected. Fix errors before deploying." -ForegroundColor Red
  Write-Host ""
  exit 1
} elseif ($warnings -gt 2 -or $missing -gt 4) {
  Write-Host "⚠ Production may have limited functionality." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Recommendations:" -ForegroundColor White
  Write-Host "  1. Add missing API keys to Parameter Store" -ForegroundColor Gray
  Write-Host "     aws ssm put-parameter --name $ParameterPrefix/GEMINI_API_KEY --value 'key' --type SecureString" -ForegroundColor Gray
  Write-Host ""
  Write-Host "  2. Redeploy Lambda to pick up new keys" -ForegroundColor Gray
  Write-Host "     .\redeploy-api-lambda.ps1 -AwsRegion $AwsRegion" -ForegroundColor Gray
  Write-Host ""
} else {
  Write-Host "✓ Production is ready for LLM API calls!" -ForegroundColor Green
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor White
  Write-Host "  1. Test a chat completion via the web UI" -ForegroundColor Gray
  Write-Host "  2. Monitor Lambda logs for any runtime errors" -ForegroundColor Gray
  Write-Host "     aws logs tail /aws/lambda/$LambdaFunctionName --region $AwsRegion --follow" -ForegroundColor Gray
  Write-Host ""
}
