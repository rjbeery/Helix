<<<<<<< HEAD
import React, { useState } from "react";

export default function App() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string|null>(null);
  const [ok, setOk] = useState(false);

  const submit = async () => {
    setError(null);
    const r = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passphrase: code })
    });
    if (r.ok) setOk(true); else setError("Invalid code");
  };

  if (ok) return <div className="p-8 text-green-400">Authenticated. Build your UI here.</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <h1 className="text-2xl font-semibold">Helix</h1>
      <div className="mt-4 flex gap-2">
        <input
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
        />
        <button onClick={submit} className="px-4 py-2 rounded bg-teal-600 hover:bg-teal-500">Go</button>
      </div>
      {error && <p className="mt-2 text-red-400">{error}</p>}
=======
import { useState } from "react";
import { verifyPasscode } from "./lib/api";

const TOKEN_KEY = "helix.jwt";
const ROLE_KEY = "helix.role";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const form = new FormData(e.target as HTMLFormElement);
    const role = (form.get("role") as string) as "master" | "fnbo";
    const passcode = String(form.get("passcode") || "").trim();
    try {
      const { token, role: r } = await verifyPasscode(passcode, role || "master");
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, r);
      setOk(true);
    } catch (e: any) {
      setErr(e.message || "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  if (ok || localStorage.getItem(TOKEN_KEY)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md border rounded-2xl p-6 text-center space-y-3">
          <img src="/helix.svg" alt="Helix AI" className="h-8 mx-auto" />
          <h1 className="text-xl font-semibold">Unlocked</h1>
          <p className="opacity-70">You’re signed in. Replace this with your app.</p>
          <button
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(ROLE_KEY);
              location.reload();
            }}
            className="mt-2 border rounded-lg px-3 py-2"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-center">
          <img src="/helix.svg" alt="Helix AI" className="h-8" />
        </div>

        <div className="space-y-1">
          <label className="text-sm">Role</label>
          <select name="role" defaultValue="master" className="w-full border rounded px-3 py-2">
            <option value="master">master</option>
            <option value="fnbo">fnbo</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm">Passcode</label>
          <input
            name="passcode"
            type="password"
            required
            className="w-full border rounded px-3 py-2"
            autoFocus
          />
        </div>

        {err && <div className="text-red-600 text-sm">{err}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg px-3 py-2 border hover:bg-black/5 disabled:opacity-50"
        >
          {loading ? "Checking..." : "Unlock"}
        </button>
      </form>
>>>>>>> origin/main
    </div>
  );
}
