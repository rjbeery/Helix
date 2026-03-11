New-Item -ItemType Directory -Force -Path "docs" | Out-Null

$root = (Get-Location).Path

$excludePatterns = @(
  '\\node_modules\\',
  '\\.git\\',
  '\\.next\\',
  '\\dist\\',
  '\\build\\',
  '\\coverage\\',
  '\\.turbo\\',
  '\\.vercel\\'
)

function Is-IncludedFile($fullName) {
  foreach ($pattern in $excludePatterns) {
    if ($fullName -match $pattern) {
      return $false
    }
  }
  return $true
}

$topDirs = Get-ChildItem -Directory |
  Select-Object -ExpandProperty Name |
  Sort-Object

$importantRoots = @(
  "apps",
  "packages",
  "infra",
  "scripts",
  "docs"
) | Where-Object { Test-Path $_ }

$files = foreach ($dir in $importantRoots) {
  Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { Is-IncludedFile $_.FullName } |
    ForEach-Object {
      $_.FullName.Replace($root + '\', '')
    }
}

$files = $files | Sort-Object

$lines = @()
$lines += "# REPO_MAP.md"
$lines += ""
$lines += "Auto-generated repo map for Helix."
$lines += "Regenerate with:"
$lines += "powershell -ExecutionPolicy Bypass -File .\scripts\update-repo-map.ps1"
$lines += ""
$lines += "## Top-level directories"
$lines += ""

foreach ($dir in $topDirs) {
  $lines += "- $dir"
}

$lines += ""
$lines += "## Important code files"
$lines += ""

foreach ($file in $files) {
  $lines += "- $file"
}

$lines | Set-Content "docs/REPO_MAP.md"

Write-Host "Updated docs/REPO_MAP.md"