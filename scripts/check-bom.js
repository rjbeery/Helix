#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ignoreDirs = new Set(['.git', 'node_modules']);
const found = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (ignoreDirs.has(e.name)) continue;
      walk(p);
    } else if (e.isFile()) {
      try {
        const fd = fs.openSync(p, 'r');
        const buf = Buffer.alloc(3);
        const bytes = fs.readSync(fd, buf, 0, 3, 0);
        fs.closeSync(fd);
        if (bytes === 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
          found.push(p);
        }
      } catch (err) {
        // ignore unreadable files
      }
    }
  }
}

walk(process.cwd());
if (found.length) {
  console.error('BOM found in files:');
  found.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('No BOMs found');
process.exit(0);
