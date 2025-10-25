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

  # Optional: push docker images to ECR
  [string]$EcrAccountId = '',
  [string]$EcrApiRepo   = '',
  [string]$EcrWebRepo   = '',
  [string]$ImageTag     = 'latest',

  [switch]$SkipDockerBuild,
  [switch]$SkipWebBuild,
  [switch]$SkipEcrPush
)

function Join-AwsArgs { param($p, $r) $parts = @(); if ($p) { $parts += "--profile $p" }; if ($r) { $parts += "--region $r" }; return $parts -join ' ' }

$awsArgs = Join-AwsArgs $AwsProfile $AwsRegion
$aws = 'aws'
if ($awsArgs) { $aws += " $awsArgs" }

Write-Host "Starting full deploy: build -> images -> push -> s3 sync -> cloudfront invalidate"

try {
  if (-not $SkipWebBuild) {
    Write-Host "Building web dist (apps/web)..."
    Push-Location 'apps/web'
    pnpm install
    pnpm build
    Pop-Location
  } else {
    Write-Host "Skipping web build (--SkipWebBuild)."
  }

  if (-not $SkipDockerBuild) {
    Write-Host "Building docker images (api + web) using docker compose..."
    docker compose build --pull api web
  } else {
    Write-Host "Skipping docker build (--SkipDockerBuild)."
  }

  if (-not $SkipEcrPush -and $EcrAccountId -and ($EcrApiRepo -or $EcrWebRepo)) {
    if (-not $AwsRegion) { throw "To push to ECR you must provide -AwsRegion and -EcrAccountId" }

    $ecrHost = "$EcrAccountId.dkr.ecr.$AwsRegion.amazonaws.com"
    Write-Host "Logging into ECR: $ecrHost (profile: $AwsProfile)"
    # Login
    & aws $awsArgs ecr get-login-password | docker login --username AWS --password-stdin $ecrHost

    if ($EcrApiRepo) {
      $localApiImage = 'helixsource-api:latest'
      $remoteApi = "$($ecrHost)/$($EcrApiRepo):$($ImageTag)"
      Write-Host "Tagging $localApiImage -> $remoteApi"
      docker tag $localApiImage $remoteApi
      Write-Host "Pushing $remoteApi"
      docker push $remoteApi
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

  Write-Host "Running frontend deploy script: deploy-frontend.ps1 -Bucket $Bucket -DistId $DistId -Profile $Profile -Region $Region"
  & $deployScript -Bucket $Bucket -DistId $DistId -Profile $Profile -Region $Region

  Write-Host "Deploy completed successfully."
} catch {
  Write-Error "Deploy failed: $_"
  exit 1
}
