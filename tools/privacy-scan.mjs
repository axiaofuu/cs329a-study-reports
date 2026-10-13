#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const excludedDirs = new Set(['.git', 'node_modules', '.cache', 'tmp']);
const binaryExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.woff', '.woff2']);
const forbiddenNames = [
  /^\.env(?:\.|$)/i,
  /^(?:id_rsa|id_ed25519)(?:\.pub)?$/i,
  /cookies?(?:\.txt|\.json)?$/i,
  /credentials?/i,
  /secrets?/i,
];
const patterns = [
  ['macOS home path', /\/Users\/[A-Za-z0-9._-]+\//g],
  ['Linux home path', /\/home\/[A-Za-z0-9._-]+\//g],
  ['Windows home path', /[A-Za-z]:\\Users\\[^\\\s]+\\/g],
  ['email address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  ['OpenAI-style key', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['bearer token', /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}=*/gi],
];

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(root);

const issues = [];
for (const file of files) {
  const relative = path.relative(root, file);
  if (forbiddenNames.some((rule) => rule.test(path.basename(file)))) {
    issues.push(`${relative}: sensitive filename`);
  }
  if (binaryExtensions.has(path.extname(file).toLowerCase())) continue;
  const stat = fs.statSync(file);
  if (stat.size > 5 * 1024 * 1024) {
    issues.push(`${relative}: unexpected text file larger than 5 MiB`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  for (const [label, pattern] of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      const line = text.slice(0, match.index).split('\n').length;
      issues.push(`${relative}:${line}: ${label}`);
    }
  }
}

if (issues.length) {
  console.error('Privacy scan failed:\n');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Privacy scan passed: ${files.length} files checked, no sensitive patterns found.`);
