# 1) Make bcrypt hashes (paste outputs into the TODOs)
python - << 'PY'
import bcrypt, getpass
print("MASTER hash:"); print(bcrypt.hashpw(getpass.getpass("MASTER code: ").encode(), bcrypt.gensalt(12)).decode())
print("FNBO hash:");   print(bcrypt.hashpw(getpass.getpass("FNBO code: ").encode(), bcrypt.gensalt(12)).decode())
PY

# 2) JWT secret
$jwt = [Convert]::ToBase64String((0..47 | ForEach-Object {Get-Random -Minimum 0 -Maximum 256}))

# 3) Write .env (EDIT the TODOs once with the hashes)
@"
JWT_SECRET=$jwt
MASTER_PASSCODE_HASH=__TODO_MASTER_BCRYPT__
FNBO_PASSCODE_HASH=__TODO_FNBO_BCRYPT__
PORT=3001
"@ | Set-Content -NoNewline -Encoding UTF8 -Path .\apps\api\.env

# 4) Run API
Start-Process powershell -ArgumentList 'uvicorn apps.api.main:app --reload --port 3001'
Start-Sleep -Seconds 2

# 5) Smoke test (replace plaintext codes here just to verify)
$masterToken = (Invoke-RestMethod -Method POST -Uri "http://localhost:3001/auth/verify" -ContentType "application/json" -Body (@{ code = "MASTER-PLAINTEXT" } | ConvertTo-Json)).token
"MASTER token: $masterToken"
