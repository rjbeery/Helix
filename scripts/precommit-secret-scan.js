#!/usr/bin/env node
/*
  Pre-commit secret scanner for staged changes.
  - Scans only staged content (index) to avoid discrepancies with working tree.
  - Blocks commits if potential secrets are detected in filenames or content.

  Override (not recommended): set SKIP_SECRET_SCAN=1 to bypass.
*/
const { execSync, spawnSync } = require('child_process');

function getStagedFiles() {
  const res = spawnSync('git', ['diff', '--cached', '--name-only', '-z'], { encoding: 'buffer' });
  if (res.status !== 0) return [];
  const buf = res.stdout || Buffer.alloc(0);
  const parts = buf.toString('utf8').split('\0').filter(Boolean);
  return parts.filter(p => !p.startsWith('node_modules/'));
}

function readStaged(path) {
  const res = spawnSync('git', ['show', `:${path}`], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 });
  if (res.status !== 0) return null;
  return res.stdout;
}

function isBinary(buf) {
  if (!buf) return false;
  const len = Math.min(buf.length, 1024);
  for (let i = 0; i < len; i++) {
    const c = buf[i];
    if (c === 0) return true; // null byte
  }
  return false;
}

const blockedNamePatterns = [
  /(^|\/)\.env(\..*)?$/i,
  /(^|\/)login-test\.json$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i,
  /\.(pem|key|p12|pfx|p8)$/i,
];

const contentPatterns = [
  { id: 'aws-access-key-id', re: /AKIA[0-9A-Z]{16}/ },
  { id: 'aws-secret-access-key', re: new RegExp("(aws)?.{0,20}(secret|access).{0,10}key.{0,10}[:=]\\s*['\"]([A-Za-z0-9/+=]{40})['\"]", 'i') },
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { id: 'jwt-secret', re: /\bJWT_SECRET\b\s*[:=]\s*[^\s'"`]+/i },
  { id: 'generic-password', re: /\b(pass(word)?|pwd)\b\s*[:=]\s*[^\s'"`]+/i },
  { id: 'api-key-like', re: /\b(API[_-]?KEY|ACCESS[_-]?KEY|SECRET[_-]?KEY|AUTH[_-]?TOKEN|BEARER)\b.{0,40}[A-Za-z0-9_\-]{12,}/i },
  { id: 'db-url', re: /(postgres(?:ql)?:\/\/)[^:\s]+:[^@\s]+@/i },
];

function scanFile(path, buf) {
  const text = buf.toString('utf8');
  const findings = [];
  for (const { id, re } of contentPatterns) {
    try {
      const m = text.match(re);
      if (m) findings.push({ id, match: String(m[0]).slice(0, 120) });
    } catch (_) {}
  }
  return findings;
}

function main() {
  if (process.env.SKIP_SECRET_SCAN === '1') process.exit(0);
  const files = getStagedFiles();
  if (!files.length) process.exit(0);

  const violations = [];
  for (const f of files) {
    if (blockedNamePatterns.some((re) => re.test(f))) {
      violations.push({ file: f, reason: 'blocked-filename' });
      continue;
    }
    const buf = readStaged(f);
    if (!buf) continue;
    if (buf.length > 2 * 1024 * 1024) continue; // skip very large files
    if (isBinary(buf)) continue; // skip binary
    const hits = scanFile(f, buf);
    for (const h of hits) violations.push({ file: f, reason: h.id, sample: h.match });
  }

  if (violations.length) {
    console.error('\n[pre-commit] Potential secrets detected; aborting commit.');
    for (const v of violations) {
      const sample = v.sample ? `\n  sample: ${v.sample.replace(/\r?\n/g, ' ')}` : '';
      console.error(` - ${v.file}\n  reason: ${v.reason}${sample}`);
    }
    console.error('\nIf this is a false positive, you may bypass with SKIP_SECRET_SCAN=1, but consider narrowing the change or adding safe patterns.');
    process.exit(1);
  }
}

try { main(); } catch (e) {
  console.error('[pre-commit] Secret scan failed:', e && e.message ? e.message : e);
  process.exit(2);
}
