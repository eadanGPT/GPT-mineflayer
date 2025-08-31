// util.js
'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function humanMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / (60 * 1000)) % 60;
  const h = Math.floor(ms / (60 * 60 * 1000));
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function safeJSON(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

function dataPath(...p) {
  const base = path.resolve(__dirname, 'data');
  ensureDir(base);
  return path.join(base, ...p);
}

module.exports = { ensureDir, humanMs, safeJSON, dataPath };
