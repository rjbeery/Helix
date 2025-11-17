# Enable pgvector extension on Aurora PostgreSQL
# Run this script to install pgvector on your Aurora cluster

# Instructions for Aurora PostgreSQL:
# 
# Option 1: Via AWS Console
# 1. Go to RDS > Databases > Select your Aurora cluster
# 2. Click "Modify"
# 3. Scroll to "DB parameter group"
# 4. In the parameter group, set shared_preload_libraries to include 'vector'
# 5. Reboot the database
# 6. Then run: CREATE EXTENSION vector;
#
# Option 2: Via AWS CLI
Write-Host "Installing pgvector on Aurora PostgreSQL..." -ForegroundColor Cyan
Write-Host ""

$dbHost = Read-Host "Enter Aurora cluster endpoint (e.g., your-cluster.cluster-xxxxx.us-east-1.rds.amazonaws.com)"
$dbName = Read-Host "Enter database name (default: helix)" 
if (-not $dbName) { $dbName = "helix" }

$dbUser = Read-Host "Enter database username (default: helix)"
if (-not $dbUser) { $dbUser = "helix" }

$dbPassword = Read-Host "Enter database password" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword)
)

Write-Host ""
Write-Host "Step 1: Checking if pgvector extension is available..." -ForegroundColor Yellow

$checkSql = "SELECT * FROM pg_available_extensions WHERE name = 'vector';"

# Install postgres client if needed
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Host "⚠️  psql not found. Please install PostgreSQL client tools:" -ForegroundColor Red
  Write-Host "   Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
  Write-Host ""
  Write-Host "Or use AWS Systems Manager Session Manager to connect to a bastion host" -ForegroundColor Gray
  exit 1
}

$env:PGPASSWORD = $dbPasswordPlain

try {
  Write-Host "Connecting to $dbHost..." -ForegroundColor Gray
  
  # Check if extension is available
  $available = psql -h $dbHost -U $dbUser -d $dbName -t -c $checkSql 2>&1
  
  if ($available -match "vector") {
    Write-Host "✅ pgvector extension is available" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Step 2: Creating vector extension..." -ForegroundColor Yellow
    psql -h $dbHost -U $dbUser -d $dbName -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1 | Write-Host
    Write-Host "✅ Vector extension created" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Step 3: Creating embeddings table..." -ForegroundColor Yellow
    $createTableSql = @"
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS embeddings_embedding_idx 
ON embeddings 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS embeddings_metadata_idx 
ON embeddings 
USING gin (metadata);

CREATE INDEX IF NOT EXISTS embeddings_created_at_idx 
ON embeddings (created_at DESC);
"@
    
    $createTableSql | psql -h $dbHost -U $dbUser -d $dbName 2>&1 | Write-Host
    Write-Host "✅ Embeddings table and indexes created" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "✅ pgvector setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now use RAG with PostgreSQL backend." -ForegroundColor Cyan
    
  } else {
    Write-Host "❌ pgvector extension is not available on this Aurora instance" -ForegroundColor Red
    Write-Host ""
    Write-Host "To enable pgvector on Aurora PostgreSQL:" -ForegroundColor Yellow
    Write-Host "1. Your Aurora version must be 15.2+ or 14.7+ or 13.10+" -ForegroundColor Gray
    Write-Host "2. Go to RDS Console > Parameter Groups" -ForegroundColor Gray
    Write-Host "3. Edit your cluster parameter group" -ForegroundColor Gray
    Write-Host "4. Set shared_preload_libraries to include 'vector'" -ForegroundColor Gray
    Write-Host "5. Reboot the database cluster" -ForegroundColor Gray
    Write-Host "6. Run this script again" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or use AWS CLI:" -ForegroundColor Yellow
    Write-Host "aws rds modify-db-cluster-parameter-group \\" -ForegroundColor Gray
    Write-Host "  --db-cluster-parameter-group-name your-param-group \\" -ForegroundColor Gray
    Write-Host "  --parameters ""ParameterName=shared_preload_libraries,ParameterValue=vector,ApplyMethod=pending-reboot""" -ForegroundColor Gray
  }
  
} catch {
  Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ""
  Write-Host "💡 Alternative: Use Pinecone instead" -ForegroundColor Yellow
  Write-Host "Set VECTOR_STORE_TYPE=pinecone in your Lambda environment" -ForegroundColor Gray
} finally {
  $env:PGPASSWORD = $null
}
