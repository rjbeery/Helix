<#
.SYNOPSIS
  Build web dist, build docker images, optionally push images to ECR, then deploy web to S3 and invalidate CloudFront.

.DESCRIPTION
  This helper wraps local build steps and the existing `deploy-frontend.ps1` so you can run a single command
  to prepare artifacts and publish the frontend. Pushing images to ECR is optional and requires
  `EcrAccountId` and repo names. The script expects `aws` CLI and `docker` to be installed and configured.

.EXAMPLE
  # Build everything and deploy frontend (uses default bucket/dist values from deploy-frontend.ps1)
  .\deploy-all.ps1 -Profile my-aws-profile -Region us-east-1

.EXAMPLE
  # Build, push web/api images to ECR and deploy frontend
  .\deploy-all.ps1 -Profile my-aws-profile -Region us-east-1 -EcrAccountId 123456789012 -EcrApiRepo helix-api -EcrWebRepo helix-web -ImageTag v1.2.3
#>

param(
  [string]$AwsProfile = '',
  [string]$AwsRegion  = '',
  [string]$Bucket     = 'helixai-site-helixai-live',
  [string]$DistId     = 'E1WTW4Q4V8UY5C',
  [string]$WebApiBase = 'https://api.helixai.live',

  # Optional: push docker images to ECR
  [string]$EcrAccountId = '',
  [string]$EcrApiRepo   = '',
  [string]$EcrWebRepo   = '',
  [string]$ImageTag     = 'latest',

  # Lambda function name for API (matches Terraform default "helixai-api")
  [string]$LambdaFunctionName = 'helixai-api',

  [switch]$SkipDockerBuild,
  [switch]$SkipWebBuild,
  [switch]$SkipEcrPush,
  [switch]$SkipLambdaUpdate
)

function New-AwsCommonArgs { param($p, $r) $arr = @(); if ($p) { $arr += @('--profile', $p) }; if ($r) { $arr += @('--region', $r) }; return ,$arr }

$awsCmd = 'aws'
$awsCommonArgs = New-AwsCommonArgs $AwsProfile $AwsRegion

Write-Host "Starting full deploy: build -> images -> push -> s3 sync -> cloudfront invalidate"

try {
  if (-not $SkipWebBuild) {
    Write-Host "Building web dist (apps/web)..."
    Push-Location 'apps/web'
    pnpm install
    # Ensure Vite has the production API base
    $env:VITE_API_URL = $WebApiBase
    pnpm build
    Pop-Location
  } else {
    Write-Host "Skipping web build (--SkipWebBuild)."
  }

  if (-not $SkipDockerBuild) {
    Write-Host "Building docker images (api + web) using docker compose..."
    docker compose build --pull api web
    Write-Host "Building AWS Lambda image for API (Dockerfile.lambda)..."
    docker build --pull -f Dockerfile.lambda -t helixsource-api-lambda:latest .
  } else {
    Write-Host "Skipping docker build (--SkipDockerBuild)."
  }

  if (-not $SkipEcrPush -and $EcrAccountId -and ($EcrApiRepo -or $EcrWebRepo)) {
    if (-not $AwsRegion) { throw "To push to ECR you must provide -AwsRegion and -EcrAccountId" }

    $ecrHost = "$EcrAccountId.dkr.ecr.$AwsRegion.amazonaws.com"
  Write-Host "Logging into ECR: $ecrHost (profile: $AwsProfile)"
  # Login
  & $awsCmd @awsCommonArgs ecr get-login-password | docker login --username AWS --password-stdin $ecrHost

    if ($EcrApiRepo) {
      # Push runtime API image (compose) if desired
      $localApiImage = 'helixsource-api:latest'
      $remoteApi = "$($ecrHost)/$($EcrApiRepo):$($ImageTag)"
  if ($null -ne (docker images -q $localApiImage)) {
        Write-Host "Tagging $localApiImage -> $remoteApi"
        docker tag $localApiImage $remoteApi
        Write-Host "Pushing $remoteApi"
        docker push $remoteApi
      } else {
        Write-Host "Note: $localApiImage not built; skipping runtime API image push."
      }

      # Push Lambda-optimized image
      $localLambdaImage = 'helixsource-api-lambda:latest'
      $remoteLambda = "$($ecrHost)/$($EcrApiRepo):$($ImageTag)"
      Write-Host "Tagging $localLambdaImage -> $remoteLambda"
      docker tag $localLambdaImage $remoteLambda
      Write-Host "Pushing $remoteLambda"
      docker push $remoteLambda

      if (-not $SkipLambdaUpdate) {
        if (-not $AwsRegion) { throw "-AwsRegion is required to update Lambda" }
        Write-Host "Updating Lambda function code to $remoteLambda"
        & $awsCmd @awsCommonArgs lambda update-function-code --function-name $LambdaFunctionName --image-uri $remoteLambda | Out-Null
        Write-Host "Publish new version and set to $LATEST (optional step skipped)"
      } else {
        Write-Host "Skipping Lambda update (--SkipLambdaUpdate)."
      }
    }

    if ($EcrWebRepo) {
      $localWebImage = 'helixsource-web:latest'
      $remoteWeb = "$($ecrHost)/$($EcrWebRepo):$($ImageTag)"
      Write-Host "Tagging $localWebImage -> $remoteWeb"
      docker tag $localWebImage $remoteWeb
      Write-Host "Pushing $remoteWeb"
      docker push $remoteWeb
    }
  } else {
    Write-Host "Skipping ECR push (either --SkipEcrPush set or missing EcrAccountId/EcrRepo)"
  }

  # Call existing deploy-frontend.ps1 to sync S3 and invalidate CloudFront
  $deployScript = Join-Path (Get-Location) 'deploy-frontend.ps1'
  if (-not (Test-Path $deployScript)) { throw "deploy-frontend.ps1 not found at $deployScript" }

  Write-Host "Running frontend deploy script: deploy-frontend.ps1 -Bucket $Bucket -DistId $DistId -AwsProfile $AwsProfile -AwsRegion $AwsRegion"
  & $deployScript -Bucket $Bucket -DistId $DistId -AwsProfile $AwsProfile -AwsRegion $AwsRegion

  Write-Host "Deploy completed successfully."
} catch {
  Write-Error "Deploy failed: $_"
  exit 1
}
