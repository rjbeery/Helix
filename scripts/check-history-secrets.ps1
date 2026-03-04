$ErrorActionPreference = 'Stop'

$patterns = @(
  'rjbeery@gmail.com',
  'Helix56789!',
  'Unsliced0-Resisting7-Shucking3-Yarn3-Hazelnut7'
)

$violations = @()

foreach ($pattern in $patterns) {
  $result = git grep -n -E -- "$pattern" (git rev-list --all) 2>$null
  if ($LASTEXITCODE -eq 0 -and $result) {
    $violations += $result
  }
}

if ($violations.Count -gt 0) {
  Write-Host "[history-secret-scan] Potential secrets found in git history:" -ForegroundColor Red
  $violations | Select-Object -Unique | ForEach-Object { Write-Host " - $_" }
  exit 1
}

Write-Host "[history-secret-scan] No configured secret patterns found in git history." -ForegroundColor Green
exit 0
