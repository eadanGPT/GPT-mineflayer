// store.js
'use strict';

const fs = require('fs');
const { nanoid } = require('nanoid');
const { dataPath, safeJSON } = require('./util');

const STORE_FILE = dataPath('store.json');

const defaultData = {
  accounts: [], // { id, label, auth, username, msaCacheDir }
  servers: []   // { id, label, host, port, version, keepAlive }
};

function load() {
  if (!fs.existsSync(STORE_FILE)) save(defaultData);
  return safeJSON(() => JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')), defaultData);
}

function save(data) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

function listAccounts() { return load().accounts; }
function listServers() { return load().servers; }

function addAccount({ label, auth, username, msaCacheDir }) {
  const db = load();
  const id = nanoid(8);
  db.accounts.push({ id, label, auth, username, msaCacheDir });
  save(db);
  return id;
}

function updateAccount(id, patch) {
  const db = load();
  const i = db.accounts.findIndex(a => a.id === id);
  if (i === -1) return false;
  db.accounts[i] = { ...db.accounts[i], ...patch };
  save(db);
  return true;
}

function removeAccount(id) {
  const db = load();
  const before = db.accounts.length;
  db.accounts = db.accounts.filter(a => a.id !== id);
  save(db);
  return db.accounts.length !== before;
}

function addServer({ label, host, port, version, keepAlive = true }) {
  const db = load();
  const id = nanoid(8);
  db.servers.push({ id, label, host, port: Number(port) || 25565, version: version || undefined, keepAlive: !!keepAlive });
  save(db);
  return id;
}

function updateServer(id, patch) {
  const db = load();
  const i = db.servers.findIndex(s => s.id === id);
  if (i === -1) return false;
  db.servers[i] = { ...db.servers[i], ...patch };
  save(db);
  return true;
}

function removeServer(id) {
  const db = load();
  const before = db.servers.length;
  db.servers = db.servers.filter(s => s.id !== id);
  save(db);
  return db.servers.length !== before;
}

function getAccount(id) { return listAccounts().find(a => a.id === id) || null; }
function getServer(id) { return listServers().find(s => s.id === id) || null; }

module.exports = {
  listAccounts, addAccount, updateAccount, removeAccount, getAccount,
  listServers, addServer, updateServer, removeServer, getServer,
  load, save
};
