Common debugging

API errors
Check lambda logs first

CORS issues
Test with

curl -X OPTIONS https://api.helixai.live/auth/login

SSM issues

aws ssm get-parameters-by-path --path "/helix/prod" --with-decryption

Engine failures
Inspect packages/engines adapters
Check MODEL_* env variables
