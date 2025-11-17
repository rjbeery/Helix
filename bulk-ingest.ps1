#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Bulk ingest multiple documents from a directory

.EXAMPLE
  # Ingest all .txt and .md files from a folder
  .\bulk-ingest.ps1 -FolderPath "./docs" -FilePattern "*.txt,*.md"
#>

param(
  [Parameter(Mandatory=$true)]
  [string]$FolderPath,
  
  [string]$FilePattern = "*.txt,*.md,*.pdf",
  
  [string]$Email,
  [string]$Password,
  
  [int]$ChunkSize = 1000,
  [int]$Overlap = 200,
  
  [string]$ApiBase = "https://api.helixai.live"
)

$ErrorActionPreference = "Stop"

# Get credentials
if (-not $Email) { $Email = Read-Host "Email" }
if (-not $Password) {
  $SecurePassword = Read-Host "Password" -AsSecureString
  $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
  )
}

# Login once
Write-Host "🔐 Logging in..." -ForegroundColor Cyan
$loginBody = @{
  email = $Email
  password = $Password
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$ApiBase/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = $loginResponse.token
Write-Host "✅ Logged in" -ForegroundColor Green
Write-Host ""

# Get files
$patterns = $FilePattern -split ","
$files = @()
foreach ($pattern in $patterns) {
  $files += Get-ChildItem -Path $FolderPath -Filter $pattern.Trim() -Recurse -File
}

if ($files.Count -eq 0) {
  Write-Warning "No files found matching pattern: $FilePattern"
  exit 0
}

Write-Host "📁 Found $($files.Count) files to ingest" -ForegroundColor Cyan
Write-Host ""

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$succeeded = 0
$failed = 0

foreach ($file in $files) {
  $documentId = $file.BaseName -replace '[^a-zA-Z0-9-_]', '-'
  
  Write-Host "📄 Ingesting: $($file.Name)" -ForegroundColor Yellow
  
  try {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    
    $body = @{
      documentId = $documentId
      content = $content
      metadata = @{
        filename = $file.Name
        path = $file.FullName
        extension = $file.Extension
        size = $file.Length
        createdAt = $file.CreationTime.ToString("yyyy-MM-dd HH:mm:ss")
      }
      chunkSize = $ChunkSize
      overlap = $Overlap
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri "$ApiBase/v1/rag/ingest" -Method POST -Body $body -Headers $headers
    
    Write-Host "   ✅ Success - $($response.chunksCreated) chunks created" -ForegroundColor Green
    $succeeded++
    
  } catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
  }
  
  Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Succeeded: $succeeded" -ForegroundColor Green
if ($failed -gt 0) {
  Write-Host "❌ Failed: $failed" -ForegroundColor Red
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
