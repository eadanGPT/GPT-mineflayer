// sessionManager.js
'use strict';

const EventEmitter = require('events');
const mineflayer = require('mineflayer');
const path = require('path');
const chalk = require('chalk');
const { dataPath, humanMs } = require('./util');

class BotSession extends EventEmitter {
  constructor({ sessionId, account, server }) {
    super();
    this.sessionId = sessionId;
    this.account = account;
    this.server = server;

    this.bot = null;
    this.state = 'init'; // init | connecting | online | ended | error
    this.startTime = Date.now();
    this.lastError = null;
    this.reconnects = 0;
    this._shouldRun = true;
    this._connect();
  }

  _log(...args) {
    this.emit('log', `[${this.label()}]`, ...args);
  }

  label() {
    return `${this.account.label}→${this.server.label}`;
  }

  info() {
    return {
      sessionId: this.sessionId,
      accountId: this.account.id,
      serverId: this.server.id,
      account: this.account.label,
      server: this.server.label,
      state: this.state,
      uptime: humanMs(Date.now() - this.startTime),
      reconnects: this.reconnects,
      lastError: this.lastError
    };
  }

  _botOptions() {
    const base = {
      host: this.server.host,
      port: this.server.port,
      version: this.server.version || false,
      keepAlive: this.server.keepAlive !== false,
    };

    if (this.account.auth === 'offline') {
      return {
        ...base,
        username: this.account.username,
        auth: 'offline'
      };
    }

    // Microsoft device-code auth with per-account cache directory
    const cacheDir = this.account.msaCacheDir ||
      path.join(dataPath('msa-cache'), this.account.id);
    return {
      ...base,
      username: this.account.username, // can be anything for MS; shown as gamertag after auth
      auth: 'microsoft',
      authServer: 'https://login.microsoftonline.com/consumers',
      profilesFolder: cacheDir,
      onMsaCode: (data) => {
        this._log(chalk.yellow(`MS login: Visit ${data.verification_uri} and enter code ${data.user_code}`));
      }
    };
  }

  _connect() {
    if (!this._shouldRun) return;
    this.state = 'connecting';
    this._log(chalk.gray('Connecting...'));

    const options = this._botOptions();
    let bot;
    try {
      bot = mineflayer.createBot(options);
    } catch (e) {
      this.lastError = String(e);
      this.state = 'error';
      this._log(chalk.red('Failed to create bot:'), e);
      this._scheduleReconnect();
      return;
    }
    this.bot = bot;

    bot.once('login', () => {
      this.state = 'online';
      this._log(chalk.green('Logged in.'));
    });

    bot.once('spawn', () => {
      this._log(chalk.green('Spawned at'), JSON.stringify(bot.entity.position));
      this.emit('online', this);
    });

    bot.on('end', (reason) => {
      this._log(chalk.red('Disconnected:'), reason);
      this.state = 'ended';
      this.lastError = reason;
      this.emit('end', reason);
      this._scheduleReconnect();
    });

    bot.on('kicked', (reason) => {
      this._log(chalk.red('Kicked:'), reason);
      this.state = 'error';
      this.lastError = reason;
      this.emit('kicked', reason);
      this._scheduleReconnect();
    });

    bot.on('error', (err) => {
      this._log(chalk.red('Error:'), err?.message || String(err));
      this.lastError = err?.message || String(err);
      this.state = 'error';
    });

    bot.on('messagestr', (msg) => {
      this.emit('chat', msg);
    });
  }

  _scheduleReconnect() {
    if (!this._shouldRun) return;
    this.reconnects += 1;
    const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(this.reconnects, 5)));
    this._log(chalk.gray(`Reconnecting in ${Math.floor(delay / 1000)}s...`));
    setTimeout(() => this._connect(), delay);
  }

  say(text) {
    if (this.bot) this.bot.chat(text);
  }

  command(cmd) {
    if (this.bot) this.bot.chat(`/${cmd}`);
  }

  stop() {
    this._shouldRun = false;
    try { this.bot?.end(); } catch {}
    this.state = 'ended';
  }
}

class SessionManager extends EventEmitter {
  constructor() {
    super();
    this._seq = 0;
    this.sessions = new Map(); // sessionId -> BotSession
  }

  list() {
    return Array.from(this.sessions.values()).map(s => s.info());
  }

  listByAccount(accountId) {
    return Array.from(this.sessions.values())
      .filter(s => s.account.id === accountId)
      .map(s => s.info());
  }

  get(sessionId) { return this.sessions.get(sessionId) || null; }

  start({ account, server }) {
    const sessionId = `${account.id}-${server.id}-${++this._seq}`;
    const s = new BotSession({ sessionId, account, server });
    this.sessions.set(sessionId, s);

    s.on('log', (...a) => this.emit('log', ...a));
    s.on('online', () => this.emit('online', s));
    s.on('end', () => this.emit('end', s));
    s.on('kicked', () => this.emit('kicked', s));
    s.on('chat', (m) => this.emit('chat', s, m));

    return s;
  }

  startMany(pairs) {
    return pairs.map(p => this.start(p));
  }

  stop(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.stop();
    this.sessions.delete(sessionId);
    return true;
  }

  stopAll(filter = () => true) {
    for (const [id, s] of this.sessions) {
      if (filter(s)) {
        s.stop();
        this.sessions.delete(id);
      }
    }
  }
}

module.exports = { SessionManager };
