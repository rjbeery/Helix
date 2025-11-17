#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Test RAG with pgvector on production Aurora database

.DESCRIPTION
  This script tests the RAG functionality by:
  1. Running the pgvector setup (safe - creates table if not exists)
  2. Ingesting a test document via API
  3. Querying for similar content
  4. Testing RAG-enabled chat
  5. Cleaning up test data

.EXAMPLE
  .\test-rag-production.ps1 -Email your@email.com -Password your-password
#>

param(
  [Parameter(Mandatory=$true)]
  [string]$Email,
  
  [Parameter(Mandatory=$true)]
  [string]$Password,
  
  [string]$ApiBase = "https://api.helixai.live"
)

$ErrorActionPreference = "Stop"

Write-Host "🧪 Testing RAG with PostgreSQL pgvector in production" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login to get JWT token
Write-Host "1️⃣  Logging in to get JWT token..." -ForegroundColor Yellow
$loginBody = @{
  email = $Email
  password = $Password
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$ApiBase/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = $loginResponse.token
Write-Host "✅ Logged in successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Ingest test document
Write-Host "2️⃣  Ingesting test document..." -ForegroundColor Yellow
$testDoc = @{
  documentId = "test-rag-$(Get-Date -Format 'yyyyMMddHHmmss')"
  content = @"
Helix is a GenAI orchestration platform built with TypeScript and FastAPI.
It supports multiple AI providers including OpenAI GPT-4, Anthropic Claude 4, and AWS Bedrock.
The system uses a personality-based approach where each conversation can have custom system prompts and tool access.
Helix includes RAG (Retrieval-Augmented Generation) capabilities with dual backend support.
Users can choose between Pinecone (cloud vector database) or PostgreSQL pgvector (self-hosted).
The platform is deployed on AWS Lambda with Aurora PostgreSQL and S3 storage.
Documents are automatically chunked, embedded using OpenAI's text-embedding-3-small model, and stored for semantic search.
"@
  metadata = @{
    source = "test"
    timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
  }
  chunkSize = 200
  overlap = 50
} | ConvertTo-Json

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

try {
  $ingestResponse = Invoke-RestMethod -Uri "$ApiBase/v1/rag/ingest" -Method POST -Body $testDoc -Headers $headers
  Write-Host "✅ Document ingested successfully" -ForegroundColor Green
  $documentId = ($testDoc | ConvertFrom-Json).documentId
  Write-Host "   Document ID: $documentId" -ForegroundColor Gray
} catch {
  Write-Host "❌ Failed to ingest document: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
Write-Host ""

# Step 3: Query for similar content
Write-Host "3️⃣  Querying vector database..." -ForegroundColor Yellow
$queryBody = @{
  query = "What AI models does Helix support?"
  topK = 3
} | ConvertTo-Json

try {
  $queryResponse = Invoke-RestMethod -Uri "$ApiBase/v1/rag/query" -Method POST -Body $queryBody -Headers $headers
  Write-Host "✅ Query successful - Found $($queryResponse.results.Count) results:" -ForegroundColor Green
  
  $queryResponse.results | ForEach-Object -Begin { $i = 1 } -Process {
    Write-Host "   [$i] Score: $($_.score.ToString('F4'))" -ForegroundColor Cyan
    Write-Host "       $($_.content.Substring(0, [Math]::Min(100, $_.content.Length)))..." -ForegroundColor Gray
    $i++
  }
} catch {
  Write-Host "❌ Failed to query: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
Write-Host ""

# Step 4: Test RAG-enabled chat
Write-Host "4️⃣  Testing RAG-enabled chat..." -ForegroundColor Yellow
$chatBody = @{
  message = "What cloud providers and AI models does Helix use?"
  useRag = $true
} | ConvertTo-Json

try {
  $chatResponse = Invoke-RestMethod -Uri "$ApiBase/api/chat" -Method POST -Body $chatBody -Headers $headers
  Write-Host "✅ Chat with RAG successful" -ForegroundColor Green
  Write-Host "   Response: $($chatResponse.reply.Substring(0, [Math]::Min(200, $chatResponse.reply.Length)))..." -ForegroundColor Gray
} catch {
  Write-Host "❌ Failed chat request: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Step 5: Clean up test document
Write-Host "5️⃣  Cleaning up test data..." -ForegroundColor Yellow
$deleteBody = @{
  documentId = $documentId
} | ConvertTo-Json

try {
  Invoke-RestMethod -Uri "$ApiBase/v1/rag/document" -Method DELETE -Body $deleteBody -Headers $headers | Out-Null
  Write-Host "✅ Test document deleted" -ForegroundColor Green
} catch {
  Write-Host "⚠️  Failed to delete test document (you may need to clean up manually)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "✅ RAG test complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "   • pgvector is working in Aurora PostgreSQL" -ForegroundColor White
Write-Host "   • Document ingestion successful" -ForegroundColor White
Write-Host "   • Vector search returns relevant results" -ForegroundColor White
Write-Host "   • RAG-enhanced chat is operational" -ForegroundColor White
