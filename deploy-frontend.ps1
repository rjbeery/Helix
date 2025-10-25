param(
  [string]$Bucket 'helixai-site-helixai-live',            # e.g. helix-web-prod
  [string]$DistId = "E1WTW4Q4V8UY5C",            # CloudFront Distribution ID
  [string]$Profile = "",      # optional AWS profile
  [string]$Region  = ""       # optional region
)

$aws = "aws"
if ($Profile) { $aws += " --profile $Profile" }
if ($Region)  { $aws += " --region $Region"  }

pushd apps/web
pnpm install
pnpm build
popd

& $aws s3 sync apps/web/dist/ "s3://$Bucket" --delete --cache-control "public,max-age=31536000,immutable"
& $aws s3 cp apps/web/dist/index.html "s3://$Bucket/index.html" --cache-control "no-cache"

if ($DistId) {
  & $aws cloudfront create-invalidation --distribution-id $DistId --paths "/*"
} else {
  Write-Host "Skipped CloudFront invalidation (no DistId provided)."
}
