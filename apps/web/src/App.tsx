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
    </div>
  );
}
