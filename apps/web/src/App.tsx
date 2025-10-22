import { useEffect, useState } from "react";
import HelixLogoTagline from "./public/images/Helix_logo_with_tagline.svg";

type VerifyResponse = { ok: true; user: { sub: string; role: "master" | "guest" } };
type LoginResponse = { token: string };
type MeResponse = { userId: string; role: "master" | "guest" };

const API_BASE = import.meta.env.VITE_API_URL ?? ""; // "" in dev (Vite proxy), full URL in prod

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [user, setUser] = useState<{ sub: string; role: "master" | "guest" } | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("helix.token");
    if (t) setToken(t);
  }, []);
/*
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Logging in…");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(`Login failed (${res.status})`);
      const data: LoginResponse = await res.json();
      localStorage.setItem("helix.token", data.token);
      setToken(data.token);
      setStatus("Login OK");
    } catch (err: any) {
      setStatus(err.message || "Login error");
    }
  }
*/
async function login(e: React.FormEvent) {
  e.preventDefault();
  setStatus("Logging in…");
  // Demo: always succeed
  const demoToken = "demo.jwt.token";
  localStorage.setItem("helix.token", demoToken);
  setToken(demoToken);
  setUser({ sub: "guest", role: "guest" });
  setStatus("Login OK");
  // Go to static agent page
  window.location.assign("/agent.html");
}

  async function verify() {
    if (!token) return setStatus("No token");
    setStatus("Verifying…");
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Verify failed (${res.status})`);
      const data: VerifyResponse = await res.json();
      setUser(data.user);
      setStatus("Token valid");
    } catch (err: any) {
      setStatus(err.message || "Verify error");
    }
  }

  async function me() {
    if (!token) return setStatus("No token");
    setStatus("Loading /v1/me…");
    try {
      const res = await fetch(`${API_BASE}/v1/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`/v1/me failed (${res.status})`);
      const data: MeResponse = await res.json();
      setUser({ sub: data.userId, role: data.role });
      setStatus("/v1/me OK");
    } catch (err: any) {
      setStatus(err.message || "/v1/me error");
    }
  }

  function logout() {
    localStorage.removeItem("helix.token");
    setToken(null);
    setUser(null);
    setStatus("Logged out");
  }

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "40px auto",
        padding: "24px",
        backgroundColor: "#1a1a1a",
        color: "#ffffff",
        fontFamily: "'Inter', system-ui, sans-serif",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
        minHeight: "400px",
      }}
    >
      {!token ? (
        <>
          {/* Logo placed at the very top of the login area with tighter spacing */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
            <img
              src={HelixLogoTagline}
              alt="Helix AI Logo"
              style={{
                width: "400px",
                height: "200px",
                filter: "drop-shadow(0 2px 4px rgba(0, 209, 255, 0.3))", // Matches theme-color #00d1ff
              }}
            />
          </div>
          <p
            style={{
              marginTop: 0,
              color: "#a0a0a0",
              fontSize: "14px",
              textAlign: "center",
              maxWidth: "80%",
              margin: "0 auto",
            }}
          >
            A modular GenAI orchestration platform for multi-model, multi-persona intelligence.
          </p>
        </>
      ) : (
        <>
          {/* Logo at the top of logged-in view for consistency */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
            <img
              src={HelixLogoTagline}
              alt="Helix AI Logo"
              style={{
                width: "64px",
                height: "64px",
                filter: "drop-shadow(0 2px 4px rgba(0, 209, 255, 0.3))",
              }}
            />
          </div>
{/*
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: 8,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              onClick={verify}
              style={{
                padding: "12px 20px",
                backgroundColor: "#28a745",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#1e7e34")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#28a745")}
            >
              Verify token
            </button>
            <button
              onClick={me}
              style={{
                padding: "12px 20px",
                backgroundColor: "#17a2b8",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#117a8b")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#17a2b8")}
            >
              /v1/me
            </button>
            <button
              onClick={logout}
              style={{
                padding: "12px 20px",
                backgroundColor: "#dc3545",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#a71d2a")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#dc3545")}
            >
              Log out
            </button>
          </div>
*/}
          <p
            style={{
              marginTop: 0,
              color: "#a0a0a0",
              fontSize: "14px",
              textAlign: "center",
              maxWidth: "80%",
              margin: "0 auto",
            }}
          >
            A modular GenAI orchestration platform for multi-model, multi-persona intelligence.
          </p>
        </>
      )}

          <form onSubmit={login} style={{ display: "grid", gap: "12px", marginTop: 8 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            style={{
              padding: "12px",
              backgroundColor: "#2a2a2a",
              color: "#ffffff",
              border: "1px solid #444",
              borderRadius: "8px",
              fontSize: "16px",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{
              padding: "12px",
              backgroundColor: "#2a2a2a",
              color: "#ffffff",
              border: "1px solid #444",
              borderRadius: "8px",
              fontSize: "16px",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "12px",
              backgroundColor: "#00d1ff", // Matches theme-color from index.html
              color: "#1a1a1a",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#00b3d9")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#00d1ff")}
          >
            Log in
          </button>
          </form>

      <div style={{ marginTop: 24, fontSize: "14px", textAlign: "center" }}>
        <strong>Status:</strong> {status || "—"}
      </div>

      <div style={{ marginTop: 16, fontSize: "14px", textAlign: "center" }}>
        <strong>User:</strong>{" "}
        {user ? (
          <code
            style={{
              backgroundColor: "#2a2a2a",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            {JSON.stringify(user)}
          </code>
        ) : (
          <span style={{ color: "#a0a0a0" }}>none</span>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: "12px", color: "#a0a0a0", textAlign: "center" }}>
        API_BASE: <code style={{ backgroundColor: "#2a2a2a", padding: "2px 6px", borderRadius: "4px" }}>
          {API_BASE || "(proxy)"}
        </code>
      </div>
    </div>
  );
}