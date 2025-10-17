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
    </div>
  );
}
