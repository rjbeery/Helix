param(
  [string]$Bucket = 'helixai-site-helixai-live',            # e.g. helix-web-prod
  [string]$DistId = "E1WTW4Q4V8UY5C",            # CloudFront Distribution ID
  [string]$AwsProfile = "",      # optional AWS profile
  [string]$AwsRegion  = ""       # optional region
)

$awsCmd = "aws"
$awsCommonArgs = @()
if ($AwsProfile) { $awsCommonArgs += @("--profile", $AwsProfile) }
if ($AwsRegion)  { $awsCommonArgs += @("--region",  $AwsRegion) }

Push-Location apps/web
pnpm install
$env:VITE_API_URL = "https://api.helixai.live"
pnpm build
Remove-Item Env:\VITE_API_URL
Pop-Location

& $awsCmd @awsCommonArgs s3 sync apps/web/dist/ "s3://$Bucket" --delete --cache-control "public,max-age=31536000,immutable"
& $awsCmd @awsCommonArgs s3 cp apps/web/dist/index.html "s3://$Bucket/index.html" --cache-control "no-cache"

if ($DistId) {
  & $awsCmd @awsCommonArgs cloudfront create-invalidation --distribution-id $DistId --paths "/*"
} else {
  Write-Host "Skipped CloudFront invalidation (no DistId provided)."
}
