import os
import bcrypt
from fastapi.testclient import TestClient
from helix_api.main import app

def test_verify_and_ping():
    pw = b"pass123"
    os.environ["JWT_SECRET"] = "test-secret"
    os.environ["USER_PASSCODE_HASH"] = bcrypt.hashpw(pw, bcrypt.gensalt()).decode()

    client = TestClient(app)

    r = client.post("/auth/verify", json={"passcode": "pass123"})
    assert r.status_code == 200
    jwt = r.json()["jwt"]

    r2 = client.get("/v1/ping", headers={"Authorization": f"Bearer {jwt}"})
    assert r2.status_code == 200
    assert r2.json()["ok"] is True
