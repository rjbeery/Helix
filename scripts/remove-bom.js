#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ignoreDirs = new Set(['.git', 'node_modules']);
const fixed = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (ignoreDirs.has(e.name)) continue;
      walk(p);
    } else if (e.isFile()) {
      try {
        const buf = fs.readFileSync(p);
        if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
          const newBuf = buf.slice(3);
          fs.writeFileSync(p, newBuf);
          fixed.push(p);
        }
      } catch (err) {
        // ignore unreadable files
      }
    }
  }
}

walk(process.cwd());
if (fixed.length) {
  console.log('Removed BOM from files:');
  fixed.forEach((f) => console.log('  ' + f));
  process.exit(0);
}
console.log('No BOMs found');
process.exit(0);
