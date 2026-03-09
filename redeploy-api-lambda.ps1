<#
.SYNOPSIS
  Rebuild and redeploy the API Lambda function with error logging fixes.

.DESCRIPTION
  This script builds the Lambda Docker image, pushes it to ECR, and updates the Lambda function.
  Run this after starting Docker Desktop.

.EXAMPLE
  .\redeploy-api-lambda.ps1 -AwsProfile default -AwsRegion us-east-1
#>

param(
  [string]$AwsProfile = '',
  [string]$AwsRegion = 'us-east-1',
  [string]$EcrAccountId = '541064517863',
  [string]$EcrRepo = 'helixai-api',
  [string]$ImageTag = 'latest-lambda',
  [string]$LambdaFunctionName = 'helixai-api'
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

Write-Host "=== Redeploying API Lambda with Error Logging ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build the Lambda Docker image
Write-Host "[1/4] Building Lambda Docker image..." -ForegroundColor Yellow
Write-Host "  Using docker build with single-platform output for Lambda compatibility..."
# Use DOCKER_BUILDKIT=0 to avoid multi-platform manifests which Lambda doesn't support
$env:DOCKER_BUILDKIT = "0"
docker build --pull -f Dockerfile.lambda -t "helixsource-api-lambda:$ImageTag" .
if ($LASTEXITCODE -ne 0) {
  throw "Docker build failed with exit code $LASTEXITCODE"
}
Write-Host "✓ Docker image built successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Login to ECR
Write-Host "[2/4] Logging into ECR..." -ForegroundColor Yellow
$ecrHost = "$EcrAccountId.dkr.ecr.$AwsRegion.amazonaws.com"
& $awsCmd @awsCommonArgs ecr get-login-password | docker login --username AWS --password-stdin $ecrHost
if ($LASTEXITCODE -ne 0) {
  throw "ECR login failed"
}
Write-Host "✓ Logged into ECR" -ForegroundColor Green
Write-Host ""

# Step 3: Tag and push to ECR
Write-Host "[3/4] Pushing image to ECR..." -ForegroundColor Yellow
$localImage = "helixsource-api-lambda:$ImageTag"
$remoteImage = "$ecrHost/$EcrRepo`:$ImageTag"

Write-Host "  Tagging: $localImage -> $remoteImage"
docker tag $localImage $remoteImage
if ($LASTEXITCODE -ne 0) {
  throw "Docker tag failed"
}

Write-Host "  Pushing: $remoteImage"
docker push $remoteImage
if ($LASTEXITCODE -ne 0) {
  throw "Docker push failed"
}
Write-Host "✓ Image pushed to ECR" -ForegroundColor Green
Write-Host ""

# Step 4: Update Lambda function
Write-Host "[4/4] Updating Lambda function code..." -ForegroundColor Yellow
Write-Host "  Function: $LambdaFunctionName"
Write-Host "  Image: $remoteImage"

$updateResult = & $awsCmd @awsCommonArgs lambda update-function-code `
  --function-name $LambdaFunctionName `
  --image-uri $remoteImage `
  2>&1

if ($LASTEXITCODE -ne 0) {
  Write-Error "Lambda update failed: $updateResult"
  throw "Lambda update failed"
}

Write-Host "✓ Lambda function updated" -ForegroundColor Green
Write-Host ""

# Wait for update to complete
Write-Host "Waiting for Lambda function to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$status = "InProgress"
$attempts = 0
$maxAttempts = 30

while ($status -eq "InProgress" -and $attempts -lt $maxAttempts) {
  $attempts++
  $funcInfo = & $awsCmd @awsCommonArgs lambda get-function --function-name $LambdaFunctionName 2>&1 | ConvertFrom-Json
  $status = $funcInfo.Configuration.LastUpdateStatus
  
  if ($status -eq "InProgress") {
    Write-Host "  Status: $status (attempt $attempts/$maxAttempts)" -ForegroundColor Gray
    Start-Sleep -Seconds 2
  }
}

if ($status -eq "Successful") {
  Write-Host "✓ Lambda function is ready" -ForegroundColor Green
} else {
  Write-Warning "Lambda function status: $status"
}

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test the API:" -ForegroundColor White
Write-Host "  Invoke-WebRequest -Uri 'https://api.helixai.live/health' -Method GET" -ForegroundColor Gray
Write-Host ""
Write-Host "View logs:" -ForegroundColor White
Write-Host "  aws logs tail /aws/lambda/$LambdaFunctionName --region $AwsRegion --follow" -ForegroundColor Gray
Write-Host ""
