import 'dotenv/config';

// Dated Anthropic model IDs we care about
const models = [
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
  'claude-3-sonnet-20240229',
  'claude-3-5-sonnet-20241022',
];

const apiKey = process.env.ANTHROPIC_API_KEY || '';
if (!apiKey) {
  console.error('Missing ANTHROPIC_API_KEY in environment.');
  process.exit(1);
}

interface AnthropicMessage { role: 'user' | 'assistant'; content: string; }

async function probe(model: string) {
  const body = {
    model,
    max_tokens: 1,
    messages: [{ role: 'user', content: 'ping' } as AnthropicMessage],
  };
  const started = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const ms = Date.now() - started;
    if (!res.ok) {
      let reason = res.statusText;
      try {
        const j: any = await res.json();
        reason = j?.error?.message || reason;
      } catch {}
      return { model, ok: false, status: res.status, reason, ms };
    }
    const json = await res.json();
    return { model, ok: true, status: res.status, ms, stop_reason: json.stop_reason };
  } catch (e) {
    return { model, ok: false, status: 0, reason: (e as Error).message, ms: Date.now() - started };
  }
}

async function main() {
  console.log('Anthropic model access probe');
  console.log('API key present =', apiKey ? 'yes' : 'no');
  for (const m of models) {
    const r = await probe(m);
    if (r.ok) {
      console.log(`${m}: ALLOWED (status ${r.status}, ${r.ms}ms)`);
    } else {
      console.log(`${m}: BLOCKED (${r.status}) - ${r.reason}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error probing models:', err);
  process.exit(1);
});
