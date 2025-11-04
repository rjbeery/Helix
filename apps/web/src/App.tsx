import { useEffect, useState } from "react";
import HelixLogoTagline from "./public/images/Helix_logo_with_tagline.svg";
import Chat from "./Chat";

type VerifyResponse = { ok: true; user: { sub: string; email: string; role: "master" | "guest"; budgetCents: number; maxBudgetPerQuestion: number; maxBatonPasses: number; truthinessThreshold: number } };
type LoginResponse = { token: string };

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [user, setUser] = useState<{ sub: string; email: string; role: "master" | "guest"; budgetCents: number; maxBudgetPerQuestion: number; maxBatonPasses: number; truthinessThreshold: number } | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("helix.token");
    if (t) setToken(t);
  }, []);

  async function verifyNow(tok: string) {
    setStatus("Verifying…");
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) throw new Error(`Verify failed (${res.status})`);
      const data: VerifyResponse = await res.json();
      setUser(data.user);
      setStatus("Token valid");
    } catch (err: any) {
      setStatus(err.message || "Verify error");
      // If verification fails, clear the token
      localStorage.removeItem("helix.token");
      setToken(null);
    }
  }

  useEffect(() => {
    if (token) {
      verifyNow(token);
    }
  }, [token]);

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
      await verifyNow(data.token);
    } catch (err: any) {
      setStatus(err.message || "Login error");
    }
  }

  function logout() {
    localStorage.removeItem("helix.token");
    setToken(null);
    setUser(null);
    setStatus("Logged out");
  }

  // If logged in, show chat interface
  if (token && user) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0d0d0d" }}>
        {/* Header with logo and logout */}
        <div style={{
          borderBottom: "1px solid #333",
          backgroundColor: "#1a1a1a",
          padding: "12px 24px"
        }}>
          <div style={{
            maxWidth: "960px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <img 
              src={HelixLogoTagline} 
              alt="Helix AI Logo" 
              style={{ height: "60px" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ color: "#a0a0a0", fontSize: "14px" }}>
                {user.email}
              </span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ color: "#00d1ff", fontSize: "14px", fontWeight: 600 }}>
                  ${(user.budgetCents / 100).toFixed(2)} total
                </span>
                <span style={{ color: "#888", fontSize: "11px" }}>
                  ${(user.maxBudgetPerQuestion / 100).toFixed(2)} max/question • max {user.maxBatonPasses} baton passes • {(user.truthinessThreshold * 100).toFixed(0)}% truthiness
                </span>
              </div>
              <button
                onClick={logout}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#dc3545",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
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
          </div>
        </div>

        {/* Chat component */}
        <Chat token={token} apiBase={API_BASE} maxBatonPasses={user.maxBatonPasses} />
      </div>
    );
  }

  // Login screen
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
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
        <img
          src={HelixLogoTagline}
          alt="Helix AI Logo"
          style={{ maxWidth: "100%", height: "auto" }}
        />
      </div>
      <p
        style={{
          marginTop: 0,
          color: "#a0a0a0",
          fontSize: "14px",
          textAlign: "center",
          maxWidth: "80%",
          margin: "0 auto 24px",
        }}
      >
        A modular GenAI orchestration platform for multi-model, multi-persona intelligence.
      </p>

      <form onSubmit={login} style={{ display: "grid", gap: "12px" }}>
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
            backgroundColor: "#00d1ff",
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
    </div>
  );
}
