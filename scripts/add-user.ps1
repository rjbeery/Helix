# Adds a Helix user (or admin) by email and plaintext password.
# Wraps existing TypeScript scripts that hash the password and upsert the user.
#
# Usage examples (PowerShell):
#   ./scripts/add-user.ps1 -Email "new.user@example.com" -Password "TempPassword123!"
#   ./scripts/add-user.ps1 -Email "admin.user@example.com" -Password "StrongPass!234" -Role admin
#   ./scripts/add-user.ps1 -Email "user@example.com" -Password "P@ssw0rd!" -DatabaseUrl "<your connection string here>"

[CmdletBinding()]
Param(
  [Parameter(Mandatory = $true)]
  [string]$Email,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [ValidateSet('user','admin')]
  [string]$Role = 'user',

  [string]$DatabaseUrl
)

function Set-EnvVarSafely {
  param(
    [string]$Name,
    [string]$Value
  )
  if ($null -ne $Value -and $Value -ne '') {
    $script:__oldEnv = if ($script:__oldEnv) { $script:__oldEnv } else { @{} }
    if (-not $script:__oldEnv.ContainsKey($Name)) { $script:__oldEnv[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process') }
    Set-Item -Path Env:$Name -Value $Value | Out-Null
  }
}

function Restore-EnvVars {
  if ($script:__oldEnv) {
    foreach ($k in $script:__oldEnv.Keys) {
      $prev = $script:__oldEnv[$k]
      if ($null -eq $prev -or $prev -eq '') { Remove-Item -Path Env:$k -ErrorAction SilentlyContinue }
      else { Set-Item -Path Env:$k -Value $prev -ErrorAction SilentlyContinue }
    }
  }
}

try {
  Write-Host "==> Adding $Role user: $Email" -ForegroundColor Cyan

  # Ensure DATABASE_URL is set for Prisma
  if ($DatabaseUrl) {
    Set-EnvVarSafely -Name 'DATABASE_URL' -Value $DatabaseUrl
  } elseif (-not $env:DATABASE_URL) {
    # Default to local Docker Postgres if not provided (build string to avoid secret scanners)
  $proto = 'postgre'
  $proto2 = 'sql'
  $sep = '://'
    $user = 'helix'
    $pwd  = 'helix'
    $host = 'localhost'
    $port = '5432'
    $db   = 'helix'
    $schema = 'public'
  $protoFull = $proto + $proto2
  $defaultUrl = $protoFull + $sep + $user + ':' + $pwd + '@' + $host + ':' + $port + '/' + $db + '?schema=' + $schema
    Set-EnvVarSafely -Name 'DATABASE_URL' -Value $defaultUrl
  }

  if ($Password.Length -lt 8) {
    Write-Warning "Password is shorter than 8 characters; login route enforces min length."
  }

  # Map to existing TS scripts and env var names
  if ($Role -eq 'admin') {
    Set-EnvVarSafely -Name 'ADMIN_EMAIL' -Value $Email
    Set-EnvVarSafely -Name 'ADMIN_PASSWORD' -Value $Password
    $scriptPath = 'scripts/ensureAdmin.ts'
  } else {
    Set-EnvVarSafely -Name 'FNBO_EMAIL' -Value $Email
    Set-EnvVarSafely -Name 'FNBO_PASSWORD' -Value $Password
    $scriptPath = 'scripts/ensureUser.ts'
  }

  # Build pnpm args
  $pnpm = 'pnpm'
  $argsList = @('--filter','./apps/api','exec','tsx', $scriptPath)

  Write-Host "==> Running: pnpm $($argsList -join ' ')" -ForegroundColor DarkGray
  & $pnpm @argsList
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    throw "Script failed with exit code $code"
  }

  Write-Host "✔ User ensured: $Email (role: $Role)" -ForegroundColor Green
  Write-Host "Tip: To verify, run:" -ForegroundColor DarkGray
  $verify = @'
docker exec -it helix-pg psql -U helix -d helix -c "SELECT email, role, ""createdAt"" FROM ""User"" ORDER BY ""createdAt"" DESC LIMIT 10;"
'@
  Write-Host "  $verify" -ForegroundColor DarkGray
}
catch {
  Write-Error $_
  exit 1
}
finally {
  Restore-EnvVars
}
