// scripts/set-secret.mjs
// Set a Cloudflare Worker secret via the Wrangler REST API. Bypasses the
// PowerShell pipe (which appends BOMs and corrupts the value) by issuing the
// request straight from Node.
//
// Usage:  node scripts/set-secret.mjs <secret_name> <value>
// Or:     node scripts/set-secret.mjs <secret_name>   # read value from .env

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const [, , name, value] = process.argv;
if (!name) {
  console.error('usage: node scripts/set-secret.mjs <secret_name> [value]');
  process.exit(2);
}

let v = value;
if (!v) {
  const envText = fs.readFileSync('.env', 'utf8').replace(/^\uFEFF/, '');
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(new RegExp(`^${name}=(.*)$`));
    if (m) {
      v = m[1].replace(/^"(.*)"$/, '$1');
      break;
    }
  }
}
if (!v) {
  console.error(`secret ${name} not found in .env`);
  process.exit(2);
}

console.log(`Setting ${name} (length=${v.length}, first byte=${v.charCodeAt(0)})...`);

// Get the account ID + API token from the local Wrangler auth state.
const whoami = execSync('npx.cmd wrangler whoami', { encoding: 'utf8' });
const accountId = whoami.match(/│\s*([a-f0-9]{32})\s*│/)?.[1];
if (!accountId) {
  console.error('Could not read account id from `wrangler whoami`.');
  process.exit(1);
}

// Wrangler stores the API token at %APPDATA%/xdg.config/.wrangler/config/default.toml
// on Windows.
const configPath = `${process.env.APPDATA}\\xdg.config\\.wrangler\\config\\default.toml`;
const token = fs.existsSync(configPath)
  ? fs.readFileSync(configPath, 'utf8').match(/oauth_token\s*=\s*"([^"]+)"/)?.[1]
  : null;

if (!token) {
  console.error('Could not read oauth_token from Wrangler config.');
  process.exit(1);
}

const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/ruthex-lms/secrets`;
const body = JSON.stringify({ name, text: v, type: 'secret_text' });
const res = await fetch(url, {
  method: 'PUT',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body,
});
const json = await res.json();
console.log('CF response:', res.status, JSON.stringify(json).slice(0, 300));
