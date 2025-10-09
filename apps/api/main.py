from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import os, time, jwt, bcrypt
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
USER_HASH = os.getenv("USER_PASSCODE_HASH", "")
MASTER_HASH = os.getenv("MASTER_PASSCODE_HASH", "")

app = FastAPI(title="Helix API")

# CORS for local dev (adjust for prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VerifyBody(BaseModel):
    code: str

class TurnBody(BaseModel):
    engine: str
    personalityId: str
    messages: list

security = HTTPBearer()

def require_auth(creds: HTTPAuthorizationCredentials = Depends(security)):
    token = creds.credentials
    try:
        jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/auth/verify")
def verify(body: VerifyBody):
    code = body.code.encode()
    valid = False
    for h in [USER_HASH, MASTER_HASH]:
        if not h:
            continue
        try:
            if bcrypt.checkpw(code, h.encode()):
                valid = True
                break
        except Exception:
            pass
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid code")
    token = jwt.encode({"exp": int(time.time()) + 60*60*6}, JWT_SECRET, algorithm="HS256")
    return {"token": token}

@app.post("/v1/turns")
def turns(body: TurnBody, _=Depends(require_auth)):
    # TODO: integrate orchestrator.runTurn
    return {"text": "stub", "usage": {"prompt_tokens": 0, "completion_tokens": 0}}
