// cli.js
'use strict';

const inquirer = require('inquirer');
const chalk = require('chalk');
const { SessionManager } = require('./sessionManager');
const store = require('./store');

const manager = new SessionManager();

manager.on('log', (...a) => console.log(...a));
manager.on('online', (s) => console.log(chalk.green(`[ONLINE] ${s.label()}`)));
manager.on('end', (s) => console.log(chalk.yellow(`[END] ${s.label()}`)));
manager.on('kicked', (s) => console.log(chalk.red(`[KICKED] ${s.label()}`)));
manager.on('chat', (s, msg) => console.log(chalk.cyan(`[CHAT ${s.label()}]`), msg));

async function mainMenu() {
  while (true) {
    const ans = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Main menu',
      choices: [
        { name: 'Accounts', value: 'accounts' },
        { name: 'Servers', value: 'servers' },
        { name: 'Sessions', value: 'sessions' },
        new inquirer.Separator(),
        { name: 'Exit', value: 'exit' }
      ]
    }]);

    if (ans.action === 'exit') process.exit(0);
    if (ans.action === 'accounts') await accountsMenu();
    if (ans.action === 'servers') await serversMenu();
    if (ans.action === 'sessions') await sessionsMenu();
  }
}

async function accountsMenu() {
  while (true) {
    const accounts = store.listAccounts();
    const choice = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Accounts',
      choices: [
        { name: 'Add account', value: 'add' },
        ...accounts.map(a => ({ name: `${a.label} [${a.auth}] (${a.username})`, value: `edit:${a.id}` })),
        new inquirer.Separator(),
        { name: 'Back', value: 'back' }
      ]
    }]);

    if (choice.action === 'back') return;

    if (choice.action === 'add') {
      const a = await inquirer.prompt([
        { type: 'input', name: 'label', message: 'Label (nickname for this account):', validate: v => v ? true : 'Required' },
        { type: 'list', name: 'auth', message: 'Auth type:', choices: ['microsoft', 'offline'] },
        { type: 'input', name: 'username', message: 'Username (email for microsoft, nickname for offline):', validate: v => v ? true : 'Required' },
        { type: 'input', name: 'msaCacheDir', message: 'Microsoft cache dir (optional, per-account):', when: a => a.auth === 'microsoft' }
      ]);
      const id = store.addAccount(a);
      console.log(chalk.green('Added account'), id);
      continue;
    }

    if (choice.action.startsWith('edit:')) {
      const id = choice.action.split(':')[1];
      await editAccount(id);
    }
  }
}

async function editAccount(id) {
  const acc = store.getAccount(id);
  if (!acc) { console.log(chalk.red('Not found')); return; }
  while (true) {
    const pick = await inquirer.prompt([{
      type: 'list',
      name: 'act',
      message: `Account: ${acc.label}`,
      choices: [
        { name: 'Edit label', value: 'label' },
        { name: 'Edit username', value: 'username' },
        ...(acc.auth === 'microsoft' ? [{ name: 'Edit MS cache dir', value: 'cache' }] : []),
        { name: chalk.red('Remove account'), value: 'remove' },
        new inquirer.Separator(),
        { name: 'Back', value: 'back' }
      ]
    }]);
    if (pick.act === 'back') return;

    if (pick.act === 'label') {
      const { v } = await inquirer.prompt([{ type: 'input', name: 'v', message: 'New label:', default: acc.label }]);
      store.updateAccount(id, { label: v });
    } else if (pick.act === 'username') {
      const { v } = await inquirer.prompt([{ type: 'input', name: 'v', message: 'New username:', default: acc.username }]);
      store.updateAccount(id, { username: v });
    } else if (pick.act === 'cache') {
      const { v } = await inquirer.prompt([{ type: 'input', name: 'v', message: 'New cache dir (blank to clear):', default: acc.msaCacheDir || '' }]);
      store.updateAccount(id, { msaCacheDir: v || undefined });
    } else if (pick.act === 'remove') {
      const { sure } = await inquirer.prompt([{ type: 'confirm', name: 'sure', message: 'Really remove this account?' }]);
      if (sure) {
        // stop any active sessions for this account
        manager.stopAll(s => s.account.id === id);
        store.removeAccount(id);
        console.log(chalk.yellow('Removed.'));
        return;
      }
    }
  }
}

async function serversMenu() {
  while (true) {
    const servers = store.listServers();
    const choice = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Servers',
      choices: [
        { name: 'Add server', value: 'add' },
        ...servers.map(s => ({ name: `${s.label} (${s.host}:${s.port}${s.version ? ` v${s.version}` : ''})`, value: `edit:${s.id}` })),
        new inquirer.Separator(),
        { name: 'Back', value: 'back' }
      ]
    }]);

    if (choice.action === 'back') return;

    if (choice.action === 'add') {
      const s = await inquirer.prompt([
        { type: 'input', name: 'label', message: 'Label:', validate: v => v ? true : 'Required' },
        { type: 'input', name: 'host', message: 'Host:', validate: v => v ? true : 'Required' },
        { type: 'input', name: 'port', message: 'Port:', default: 25565, filter: v => Number(v) || 25565 },
        { type: 'input', name: 'version', message: 'Version (optional, e.g. 1.20.1):' },
        { type: 'confirm', name: 'keepAlive', message: 'Keep alive?', default: true }
      ]);
      const id = store.addServer(s);
      console.log(chalk.green('Added server'), id);
      continue;
    }

    if (choice.action.startsWith('edit:')) {
      const id = choice.action.split(':')[1];
      await editServer(id);
    }
  }
}

async function editServer(id) {
  const srv = store.getServer(id);
  if (!srv) { console.log(chalk.red('Not found')); return; }
  while (true) {
    const pick = await inquirer.prompt([{
      type: 'list',
      name: 'act',
      message: `Server: ${srv.label}`,
      choices: [
        { name: 'Edit label', value: 'label' },
        { name: 'Edit host', value: 'host' },
        { name: 'Edit port', value: 'port' },
        { name: 'Edit version', value: 'version' },
        { name: 'Toggle keepAlive', value: 'keep' },
        { name: chalk.red('Remove server'), value: 'remove' },
        new inquirer.Separator(),
        { name: 'Back', value: 'back' }
      ]
    }]);
    if (pick.act === 'back') return;

    if (pick.act === 'label') {
      const { v } = await inquirer.prompt([{ type: 'input', name: 'v', message: 'New label:', default: srv.label }]);
      store.updateServer(id, { label: v });
    } else if (pick.act === 'host') {
      const { v } = await inquirer.prompt([{ type: 'input', name: 'v', message: 'New host:', default: srv.host }]);
      store.updateServer(id, { host: v });
    } else if (pick.act === 'port') {
      const { v } = await inquirer.prompt([{ type: 'number', name: 'v', message: 'New port:', default: srv.port }]);
      store.updateServer(id, { port: v || 25565 });
    } else if (pick.act === 'version') {
      const { v } = await inquirer.prompt([{ type: 'input', name: 'v', message: 'Version (blank to clear):', default: srv.version || '' }]);
      store.updateServer(id, { version: v || undefined });
    } else if (pick.act === 'keep') {
      store.updateServer(id, { keepAlive: !srv.keepAlive });
    } else if (pick.act === 'remove') {
      const { sure } = await inquirer.prompt([{ type: 'confirm', name: 'sure', message: 'Really remove this server?' }]);
      if (sure) {
        // stop any active sessions for this server
        manager.stopAll(s => s.server.id === id);
        store.removeServer(id);
        console.log(chalk.yellow('Removed.'));
        return;
      }
    }
  }
}

function sessionsTable(rows) {
  if (rows.length === 0) {
    console.log(chalk.gray('No active sessions.'));
    return;
  }
  const headers = ['ID', 'Account', 'Server', 'State', 'Uptime', 'Reconn', 'LastError'];
  console.log(chalk.bold(headers.join(' | ')));
  for (const r of rows) {
    console.log([
      r.sessionId,
      r.account,
      r.server,
      r.state,
      r.uptime,
      r.reconnects,
      r.lastError ? String(r.lastError).slice(0, 60) : ''
    ].join(' | '));
  }
}

async function sessionsMenu() {
  while (true) {
    const ans = await inquirer.prompt([{
      type: 'list',
      name: 'act',
      message: 'Sessions',
      choices: [
        { name: 'Start sessions (pick accounts and servers)', value: 'start' },
        { name: 'List active sessions', value: 'list' },
        { name: 'Attach to a session console', value: 'attach' },
        { name: 'Stop session(s)', value: 'stop' },
        new inquirer.Separator(),
        { name: 'Back', value: 'back' }
      ]
    }]);

    if (ans.act === 'back') return;

    if (ans.act === 'start') {
      const accounts = store.listAccounts();
      const servers = store.listServers();
      if (accounts.length === 0 || servers.length === 0) {
        console.log(chalk.yellow('Add at least one account and one server first.'));
        continue;
      }
      const pick = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'acc',
          message: 'Choose accounts:',
          choices: accounts.map(a => ({ name: `${a.label} [${a.auth}] (${a.username})`, value: a.id }))
        },
        {
          type: 'checkbox',
          name: 'srv',
          message: 'Choose servers:',
          choices: servers.map(s => ({ name: `${s.label} (${s.host}:${s.port}${s.version ? ` v${s.version}` : ''})`, value: s.id }))
        }
      ]);
      const pairs = [];
      for (const aid of pick.acc) {
        for (const sid of pick.srv) {
          pairs.push({ account: store.getAccount(aid), server: store.getServer(sid) });
        }
      }
      manager.startMany(pairs);
      continue;
    }

    if (ans.act === 'list') {
      sessionsTable(manager.list());
      continue;
    }

    if (ans.act === 'attach') {
      const list = manager.list();
      if (list.length === 0) { console.log(chalk.gray('No sessions.')); continue; }
      const { sid } = await inquirer.prompt([{
        type: 'list',
        name: 'sid',
        message: 'Attach to session:',
        choices: list.map(r => ({ name: `${r.sessionId} — ${r.account} → ${r.server} [${r.state}]`, value: r.sessionId }))
      }]);
      await attachConsole(sid);
      continue;
    }

    if (ans.act === 'stop') {
      const list = manager.list();
      if (list.length === 0) { console.log(chalk.gray('No sessions.')); continue; }
      const { sids } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'sids',
        message: 'Stop which sessions?',
        choices: list.map(r => ({ name: `${r.sessionId} — ${r.account} → ${r.server}`, value: r.sessionId }))
      }]);
      for (const sid of sids) manager.stop(sid);
      console.log(chalk.yellow(`Stopped ${sids.length} session(s).`));
      continue;
    }
  }
}

async function attachConsole(sessionId) {
  const s = manager.get(sessionId);
  if (!s) { console.log(chalk.red('Session not found')); return; }

  console.log(chalk.bold(`Attached: ${s.label()}`));
  console.log(chalk.gray('Type messages to chat, or commands: /cmd; type :help for options, :exit to detach.'));

  let listening = true;
  const onChat = (sess, msg) => {
    if (sess.sessionId === sessionId && listening) {
      console.log(chalk.cyan(`[CHAT]`), msg);
    }
  };
  manager.on('chat', onChat);

  // Simple REPL-like loop using inquirer input
  while (listening) {
    const { line } = await inquirer.prompt([{ type: 'input', name: 'line', message: '>' }]);
    if (!line) continue;
    if (line === ':exit') break;
    if (line === ':help') {
      console.log(':exit — detach, :help — this help, :where — coords, :players — list players');
      continue;
    }
    if (line === ':where') {
      const pos = s.bot?.entity?.position;
      console.log(pos ? `At ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}` : 'Unknown');
      continue;
    }
    if (line === ':players') {
      const names = Object.keys(s.bot?.players || {});
      console.log('Players:', names.join(', '));
      continue;
    }
    if (line.startsWith('/')) {
      s.command(line.slice(1));
    } else {
      s.say(line);
    }
  }

  manager.off('chat', onChat);
  console.log(chalk.gray('Detached.'));
}

mainMenu().catch(err => {
  console.error(err);
  process.exit(1);
});
