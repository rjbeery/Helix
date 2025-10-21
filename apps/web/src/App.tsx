import { useEffect, useState } from "react";

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
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Helix AI</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        Dev proxy: /auth and /v1 → API on 3001. In prod, set VITE_API_URL.
      </p>

      {!token ? (
        <form onSubmit={login} style={{ display: "grid", gap: 8, marginTop: 16 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button type="submit">Log in</button>
        </form>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={verify}>Verify token</button>
          <button onClick={me}>/v1/me</button>
          <button onClick={logout}>Log out</button>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 14 }}>
        <strong>Status:</strong> {status || "—"}
      </div>

      <div style={{ marginTop: 16, fontSize: 14 }}>
        <strong>User:</strong>{" "}
        {user ? (
          <code>{JSON.stringify(user)}</code>
        ) : (
          <span style={{ color: "#999" }}>none</span>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "#999" }}>
        API_BASE: <code>{API_BASE || "(proxy)"}</code>
      </div>
    </div>
  );
}
