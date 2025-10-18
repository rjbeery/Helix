import React, { useEffect, useState } from 'react';
function Header() {
    return (<header className="w-full border-b border-gray-800 py-4 mb-8 bg-gray-950/70">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center text-gray-950 font-bold">
            H
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Helix</h1>
            <p className="text-sm text-gray-400">
              A modular GenAI orchestration platform for multi-model, multi-persona intelligence
            </p>
          </div>
        </div>
      </div>
    </header>);
}
export default function App() {
    const [token, setToken] = useState(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState(null);
    useEffect(() => {
        const t = localStorage.getItem('authToken');
        if (t)
            setToken(t);
    }, []);
    async function submit() {
        setError(null);
        const res = await fetch('http://localhost:8081/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        if (!res.ok) {
            setError('Invalid passcode');
            return;
        }
        const data = await res.json();
        localStorage.setItem('authToken', data.token);
        setToken(data.token);
    }
    if (!token) {
        return (<div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <Header />
        <main className="flex-1 w-full max-w-md mx-auto p-6">
          <h2 className="text-xl mb-2">Enter Access Code</h2>
          <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded" placeholder="Invite code" value={code} onChange={e => setCode(e.target.value)}/>
          <button onClick={submit} className="mt-3 px-4 py-2 rounded bg-teal-600 hover:bg-teal-500">
            Continue
          </button>
          {error && <p className="mt-2 text-red-400">{error}</p>}
        </main>
      </div>);
    }
    return (<div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto p-6">
        <p className="text-gray-400">Authenticated. Build your chat UI here.</p>
      </main>
    </div>);
}
