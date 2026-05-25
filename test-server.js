#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const url = require('url');
const path = require('path');

// Load .env.local manually
const envPath = './.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      let value = valueParts.join('=').replace(/^"(.*)"$/, '$1');
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

console.log('[server] Loaded SUPABASE_URL:', process.env.SUPABASE_URL?.substring(0, 30) + '...');
console.log('[server] Loaded SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'yes' : 'NO (ERROR)');

// Load and execute register handler
let registerHandler;
try {
  registerHandler = require('./api/auth/register.js');
} catch (e) {
  console.error('[server] Failed to load register handler:', e.message);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    return registerHandler(req, res);
  }

  // Serve static files
  if (pathname === '/' || pathname === '/login.html' || pathname === '/index.html') {
    const filePath = pathname === '/' ? './index.html' : '.' + pathname;
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const contentType = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.jpg': 'image/jpeg',
        '.png': 'image/png',
      }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✓ Full server running on http://localhost:${PORT}`);
  console.log(`✓ Open http://localhost:${PORT}/login.html to test signup\n`);
});
