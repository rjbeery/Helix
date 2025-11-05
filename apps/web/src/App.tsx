import { useEffect, useState } from "react";
import HelixLogoTagline from "./public/images/Helix_logo_with_tagline.svg";
import Chat from "./Chat";

type VerifyResponse = { ok: true; user: { sub: string; email: string; role: "admin" | "user"; budgetCents: number; maxBudgetPerQuestion: number; maxBatonPasses: number; truthinessThreshold: number } };
type LoginResponse = { token: string };

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [user, setUser] = useState<{ sub: string; email: string; role: "admin" | "user"; budgetCents: number; maxBudgetPerQuestion: number; maxBatonPasses: number; truthinessThreshold: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editedBudget, setEditedBudget] = useState<string>("0.00");
  const [editedMaxPerQuestion, setEditedMaxPerQuestion] = useState<string>("0.00");
  const [editedMaxBatonPasses, setEditedMaxBatonPasses] = useState(0);
  const [editedTruthinessThreshold, setEditedTruthinessThreshold] = useState(0);
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword1, setNewPassword1] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwStatus, setPwStatus] = useState<string>("");

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

  function openSettings() {
    if (!user) return;
    // Edit in dollars (X.XX) as strings
    setEditedBudget((user.budgetCents / 100).toFixed(2));
    setEditedMaxPerQuestion((user.maxBudgetPerQuestion / 100).toFixed(2));
    setEditedMaxBatonPasses(user.maxBatonPasses);
    setEditedTruthinessThreshold(user.truthinessThreshold * 100);
    setShowSettings(true);
  }

  // Money input helpers (allow only digits and one dot; max 2 decimals)
  function sanitizeMoneyInput(value: string): string {
    // Remove invalid chars
    let v = value.replace(/[^0-9.]/g, "");
    // Keep only first dot
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
    // Limit to two decimals
    if (firstDot !== -1) {
      const [intPart, decPart] = v.split(".");
      v = intPart + "." + decPart.slice(0, 2);
    }
    // Prevent leading zeros like 000 -> 0
    v = v.replace(/^0+(?=\d)/, "");
    // Edge case: empty or just dot
    if (v === ".") v = "0.";
    return v;
  }

  function normalizeMoneyOnBlur(value: string): string {
    if (!value || value === "." || value === "0.") return "0.00";
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return "0.00";
    return num.toFixed(2);
  }

  async function saveSettings() {
    if (!user || !token) return;
    try {
      const body: any = {
        maxBatonPasses: editedMaxBatonPasses,
        truthinessThreshold: editedTruthinessThreshold / 100,
      };
      if (user.role === "admin") {
        // Convert dollars (strings) to cents on save
        body.budgetCents = Math.round((parseFloat(editedBudget) || 0) * 100);
        body.maxBudgetPerQuestion = Math.round((parseFloat(editedMaxPerQuestion) || 0) * 100);
      }
      const res = await fetch(`${API_BASE}/api/users/${user.sub}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to update settings (${res.status})`);
      const updated = await res.json();
      setUser({ ...user, ...updated });
      setShowSettings(false);
      setStatus("Settings saved");
    } catch (err: any) {
      setStatus(err.message || "Failed to save settings");
    }
  }

  async function changePassword() {
    if (!token) return;
    setPwStatus("");
    if (!currentPassword || !newPassword1 || !newPassword2) {
      setPwStatus("Please fill out all password fields.");
      return;
    }
    if (newPassword1.length < 8) {
      setPwStatus("New password must be at least 8 characters.");
      return;
    }
    if (newPassword1 !== newPassword2) {
      setPwStatus("New passwords do not match.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword: newPassword1 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to change password (${res.status})`);
      }
      setPwStatus("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword1("");
      setNewPassword2("");
    } catch (e: any) {
      setPwStatus(e?.message || "Failed to change password");
    }
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
              <div 
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", cursor: "pointer" }}
                onClick={openSettings}
                title="Click to edit settings"
              >
                <span style={{ color: "#00d1ff", fontSize: "14px", fontWeight: 600 }}>
                  ${ (user.budgetCents / 100).toFixed(2) } total
                </span>
                <span 
                  style={{ color: "#888", fontSize: "11px" }}
                  title={`Max cost per question: $${ (user.maxBudgetPerQuestion / 100).toFixed(2) } | Max personas in sequential baton chain: ${user.maxBatonPasses} | Answer quality threshold: ${(user.truthinessThreshold * 100).toFixed(0)}% (agents stop when answer is good enough)`}
                >
                  ${ (user.maxBudgetPerQuestion / 100).toFixed(2) } max/question • max {user.maxBatonPasses} baton passes • {(user.truthinessThreshold * 100).toFixed(0)}% truthiness
                </span>
              </div>
              <button
                onClick={openSettings}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
              >
                Settings
              </button>
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

        {/* Settings Modal */}
        {showSettings && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #444",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "500px",
              width: "90%"
            }}>
              <h2 style={{ color: "#fff", marginTop: 0, marginBottom: "24px" }}>User Settings</h2>
              {/* Password Change */}
              <div style={{
                padding: "16px",
                border: "1px solid #333",
                borderRadius: "8px",
                marginBottom: "20px",
                backgroundColor: "#121212",
              }}>
                <h3 style={{ color: "#ddd", margin: 0, marginBottom: "12px", fontSize: "16px" }}>Change Password</h3>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", color: "#a0a0a0", fontSize: "13px", marginBottom: "6px" }}>Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      style={{
                        width: "100%",
                        padding: "10px",
                        backgroundColor: "#0d0d0d",
                        border: "1px solid #444",
                        borderRadius: "6px",
                        color: "#fff",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#a0a0a0", fontSize: "13px", marginBottom: "6px" }}>New Password</label>
                    <input
                      type="password"
                      value={newPassword1}
                      onChange={(e) => setNewPassword1(e.target.value)}
                      autoComplete="new-password"
                      style={{
                        width: "100%",
                        padding: "10px",
                        backgroundColor: "#0d0d0d",
                        border: "1px solid #444",
                        borderRadius: "6px",
                        color: "#fff",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#a0a0a0", fontSize: "13px", marginBottom: "6px" }}>Confirm New Password</label>
                    <input
                      type="password"
                      value={newPassword2}
                      onChange={(e) => setNewPassword2(e.target.value)}
                      autoComplete="new-password"
                      style={{
                        width: "100%",
                        padding: "10px",
                        backgroundColor: "#0d0d0d",
                        border: "1px solid #444",
                        borderRadius: "6px",
                        color: "#fff",
                        fontSize: "14px"
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      onClick={changePassword}
                      style={{
                        padding: "10px 16px",
                        backgroundColor: "#16a34a",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        cursor: "pointer"
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#15803d")}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#16a34a")}
                    >
                      Update Password
                    </button>
                    <span style={{ color: pwStatus?.startsWith("Password updated") ? "#22c55e" : "#bbb", fontSize: "13px" }}>{pwStatus}</span>
                  </div>
                </div>
              </div>
              
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", color: "#a0a0a0", fontSize: "13px", marginBottom: "6px" }}>
                  Total Budget ($)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editedBudget}
                  onChange={(e) => setEditedBudget(sanitizeMoneyInput(e.target.value))}
                  onBlur={(e) => setEditedBudget(normalizeMoneyOnBlur(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#0d0d0d",
                    border: "1px solid #444",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "14px"
                  }}
                  disabled={user.role !== "admin"}
                />
                {user.role !== "admin" && (
                  <div style={{ color: "#666", fontSize: "11px", marginTop: "4px" }}>
                    Admin-only setting
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", color: "#a0a0a0", fontSize: "13px", marginBottom: "6px" }}>
                  Max Budget Per Question ($)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editedMaxPerQuestion}
                  onChange={(e) => setEditedMaxPerQuestion(sanitizeMoneyInput(e.target.value))}
                  onBlur={(e) => setEditedMaxPerQuestion(normalizeMoneyOnBlur(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#0d0d0d",
                    border: "1px solid #444",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "14px"
                  }}
                  disabled={user.role !== "admin"}
                />
                {user.role !== "admin" && (
                  <div style={{ color: "#666", fontSize: "11px", marginTop: "4px" }}>
                    Admin-only setting
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", color: "#a0a0a0", fontSize: "13px", marginBottom: "6px" }}>
                  Max Baton Passes
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={editedMaxBatonPasses}
                  onChange={(e) => setEditedMaxBatonPasses(parseInt(e.target.value) || 1)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#0d0d0d",
                    border: "1px solid #444",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "14px"
                  }}
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", color: "#a0a0a0", fontSize: "13px", marginBottom: "6px" }}>
                  Truthiness Threshold (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editedTruthinessThreshold}
                  onChange={(e) => setEditedTruthinessThreshold(parseFloat(e.target.value) || 0)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#0d0d0d",
                    border: "1px solid #444",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "14px"
                  }}
                />
                <div style={{ color: "#666", fontSize: "11px", marginTop: "4px" }}>
                  Agents stop when answer quality reaches this threshold
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowSettings(false)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#333",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveSettings}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

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
