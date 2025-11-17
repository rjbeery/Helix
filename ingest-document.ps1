#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Ingest a document into Helix RAG system

.DESCRIPTION
  Supports: .txt, .md, .pdf, .docx, .tex, .json, .csv
  Files are automatically parsed and chunked for optimal RAG performance.

.EXAMPLE
  # Ingest a PDF
  .\ingest-document.ps1 -FilePath "research-paper.pdf" -DocumentId "research-2025"

.EXAMPLE
  # Ingest a LaTeX file
  .\ingest-document.ps1 -FilePath "thesis.tex" -DocumentId "phd-thesis"

.EXAMPLE
  # Ingest with custom metadata
  .\ingest-document.ps1 -FilePath "policy.docx" -DocumentId "policy-1" -Metadata @{department="HR"; version="1.0"}
#>

param(
  [Parameter(Mandatory=$true)]
  [string]$FilePath,
  
  [Parameter(Mandatory=$true)]
  [string]$DocumentId,
  
  [hashtable]$Metadata = @{},
  
  [string]$Email,
  [string]$Password,
  [string]$JwtToken,
  
  [int]$ChunkSize = 1000,
  [int]$Overlap = 200,
  
  [string]$ApiBase = "https://api.helixai.live"
)

$ErrorActionPreference = "Stop"

# Get JWT token if not provided
if (-not $JwtToken) {
  if (-not $Email -or -not $Password) {
    $Email = Read-Host "Email"
    $Password = Read-Host "Password" -AsSecureString
    $PasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    )
  } else {
    $PasswordPlain = $Password
  }
  
  Write-Host "🔐 Logging in..." -ForegroundColor Cyan
  $loginBody = @{
    email = $Email
    password = $PasswordPlain
  } | ConvertTo-Json
  
  $loginResponse = Invoke-RestMethod -Uri "$ApiBase/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
  $JwtToken = $loginResponse.token
  Write-Host "✅ Logged in" -ForegroundColor Green
}

# Read file
if (-not (Test-Path $FilePath)) {
  Write-Error "File not found: $FilePath"
  exit 1
}

$fileExt = [System.IO.Path]::GetExtension($FilePath).ToLower()
$supportedTextTypes = @('.txt', '.md', '.json', '.csv', '.log')
$supportedBinaryTypes = @('.pdf', '.docx', '.tex')

Write-Host "📄 Uploading file: $FilePath" -ForegroundColor Cyan

# Prepare headers
$headers = @{
  "Authorization" = "Bearer $JwtToken"
}

# For text files, use JSON endpoint
if ($supportedTextTypes -contains $fileExt) {
  Write-Host "   Using text ingestion endpoint..." -ForegroundColor Gray
  $content = Get-Content -Path $FilePath -Raw -Encoding UTF8
  
  $headers["Content-Type"] = "application/json"
  
  $body = @{
    documentId = $DocumentId
    content = $content
    metadata = $Metadata
    chunkSize = $ChunkSize
    overlap = $Overlap
  } | ConvertTo-Json -Depth 10
  
  $uri = "$ApiBase/v1/rag/ingest"
  
} else {
  # For PDF, DOCX, TEX use file upload endpoint
  Write-Host "   Using file upload endpoint (parsing $fileExt)..." -ForegroundColor Gray
  
  $fileBytes = [System.IO.File]::ReadAllBytes($FilePath)
  $fileName = [System.IO.Path]::GetFileName($FilePath)
  
  $boundary = [System.Guid]::NewGuid().ToString()
  $headers["Content-Type"] = "multipart/form-data; boundary=$boundary"
  
  # Build multipart form data
  $bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
    "Content-Type: application/octet-stream",
    "",
    [System.Text.Encoding]::GetEncoding('iso-8859-1').GetString($fileBytes),
    "--$boundary",
    "Content-Disposition: form-data; name=`"documentId`"",
    "",
    $DocumentId,
    "--$boundary",
    "Content-Disposition: form-data; name=`"chunkSize`"",
    "",
    $ChunkSize.ToString(),
    "--$boundary",
    "Content-Disposition: form-data; name=`"overlap`"",
    "",
    $Overlap.ToString()
  )
  
  if ($Metadata.Count -gt 0) {
    $metadataJson = $Metadata | ConvertTo-Json -Compress
    $bodyLines += @(
      "--$boundary",
      "Content-Disposition: form-data; name=`"metadata`"",
      "",
      $metadataJson
    )
  }
  
  $bodyLines += "--$boundary--"
  
  $body = $bodyLines -join "`r`n"
  $uri = "$ApiBase/v1/rag/upload"
}

# Ingest document
Write-Host "📤 Uploading and processing..." -ForegroundColor Cyan
try {
  $response = Invoke-RestMethod -Uri $uri -Method POST -Body $body -Headers $headers
  
  Write-Host "✅ Document ingested successfully!" -ForegroundColor Green
  Write-Host "   Document ID: $DocumentId" -ForegroundColor Gray
  Write-Host "   Chunks created: $($response.chunksIngested)" -ForegroundColor Gray
  if ($response.contentLength) {
    Write-Host "   Content extracted: $($response.contentLength) characters" -ForegroundColor Gray
  }
  Write-Host ""
  Write-Host "You can now query this document or use RAG in chat with useRag:true" -ForegroundColor Cyan
  
} catch {
  Write-Error "Failed to ingest document: $($_.Exception.Message)"
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    $reader.DiscardBufferedData()
    $responseBody = $reader.ReadToEnd()
    Write-Host "Server response: $responseBody" -ForegroundColor Red
  }
  exit 1
}
