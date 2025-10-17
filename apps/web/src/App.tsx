import React, { useState } from "react";

type Auth = { ok: true; role?: "master" | "fnbo" };

export default function App() {
  const [code, setCode] = useState("");
  const [auth, setAuth] = useState<Auth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: code.trim() }),
      });
      if (!r.ok) {
        setError("Invalid code");
        setAuth(null);
        return;
      }
      const data = (await r.json()) as Auth;
      if (data?.ok) setAuth(data);
      else setError("Invalid code");
    } catch {
      setError("Network error. Is the API running on 3001?");
    } finally {
      setLoading(false);
    }
  };

  if (auth?.ok) {
    return (
      <div className="pt-6 min-h-screen bg-gray-950 text-gray-100">
        {/* ADMIN banner */}
        {auth?.role === "master" && (
          <div className="fixed top-0 left-0 right-0 bg-red-700 text-white text-xs font-bold tracking-widest text-center py-1 z-50">
            ADMIN
          </div>
        )}

        <div className="p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded bg-gray-900 border border-gray-700 px-3 py-2">
            <span className="text-sm text-gray-400">Logged in as</span>
            <span className="text-sm font-semibold text-teal-400">
              {auth.role ?? "user"}
            </span>
          </div>

          <h1 className="text-2xl font-semibold">Helix</h1>
          <p className="mt-2 text-green-400">Authenticated. Build your UI here.</p>

          {auth.role === "master" && (
            <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-4">
              <h2 className="text-lg font-semibold">Master tools</h2>
              <p className="text-sm text-gray-300 mt-1">Admin-only actions go here.</p>
            </div>
          )}

          {auth.role === "fnbo" && (
            <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-4">
              <h2 className="text-lg font-semibold">FNBO view</h2>
              <p className="text-sm text-gray-300 mt-1">Partner-specific view.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-2xl font-semibold">Helix</h1>

      <div className="mt-4 flex gap-2">
        <input
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded outline-none"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Access code"
          type="password"
          autoFocus
        />
        <button
          onClick={submit}
          disabled={loading}
          className="px-4 py-2 rounded bg-teal-600 hover:bg-teal-500 disabled:opacity-60"
        >
          {loading ? "Checking..." : "Go"}
        </button>
      </div>

      {error && <p className="mt-2 text-red-400">{error}</p>}
    </div>
  );
}
