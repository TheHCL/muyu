'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { sanitize, generate } = require('./nicknames');

// ── SQLite setup ─────────────────────────────────────────────
const DB_PATH = path.join(__dirname, '../../data/muyu.db');

// Ensure data directory exists
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS stats (
    key   TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS players (
    clientId TEXT PRIMARY KEY,
    nick     TEXT NOT NULL,
    hits     INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO stats (key, value) VALUES ('globalTotal', 0);
`);

// Prepared statements
const stmtGetTotal      = db.prepare(`SELECT value FROM stats WHERE key = 'globalTotal'`);
const stmtAddTotal      = db.prepare(`UPDATE stats SET value = value + 1 WHERE key = 'globalTotal'`);
const stmtGetPlayer     = db.prepare(`SELECT nick, hits FROM players WHERE clientId = ?`);
const stmtUpsertHit     = db.prepare(`INSERT INTO players (clientId, nick, hits) VALUES (?, ?, 1) ON CONFLICT(clientId) DO UPDATE SET hits = hits + 1`);
const stmtSetNickDB     = db.prepare(`UPDATE players SET nick = ? WHERE clientId = ?`);
const stmtLeaderboard   = db.prepare(`SELECT nick, hits FROM players ORDER BY hits DESC LIMIT ?`);


// ── In-memory runtime state ──────────────────────────────────
// Map<ws, { clientId, nick, hits_session }>
const clients = new Map();

// Rate limiter: Map<clientId, { count, resetAt }>
const rateLimits = new Map();

const LEADERBOARD_SIZE = 10;
const RATE_LIMIT = 20;

// ── Public API ───────────────────────────────────────────────

function addClient(ws, clientId, rawNick) {
  // Look up existing player from DB
  const existing = stmtGetPlayer.get(clientId);
  let nick;
  if (existing) {
    nick = existing.nick;
  } else {
    nick = sanitize(rawNick) || generate();
  }
  clients.set(ws, { clientId, nick, hits: existing?.hits ?? 0 });
  return { nick };
}

function removeClient(ws) {
  clients.delete(ws);
}

function recordHit(ws) {
  const client = clients.get(ws);
  if (!client) return null;

  // Rate limiting
  const now = Date.now();
  let rl = rateLimits.get(client.clientId);
  if (!rl || now > rl.resetAt) {
    rl = { count: 0, resetAt: now + 1000 };
    rateLimits.set(client.clientId, rl);
  }
  rl.count++;
  if (rl.count > RATE_LIMIT) return null;

  // Update DB synchronously (fast prepared statements, ~0.1ms per op)
  stmtAddTotal.run();
  stmtUpsertHit.run(client.clientId, client.nick);

  client.hits++;

  return { globalTotal: getGlobalTotal(), nick: client.nick };
}

function setNick(ws, rawNick) {
  const client = clients.get(ws);
  if (!client) return null;
  const nick = sanitize(rawNick);
  if (!nick) return null;
  client.nick = nick;
  stmtSetNickDB.run(nick, client.clientId);
  return nick;
}

function getOnlineCount() {
  return clients.size;
}

function getLeaderboard() {
  // Reads directly from DB — every hit is written immediately so this is always current
  return stmtLeaderboard.all(LEADERBOARD_SIZE);
}

function getClientInfo(ws) {
  return clients.get(ws) || null;
}

function getGlobalTotal() {
  return stmtGetTotal.get()?.value ?? 0;
}

module.exports = {
  addClient,
  removeClient,
  recordHit,
  setNick,
  getOnlineCount,
  getLeaderboard,
  getClientInfo,
  getGlobalTotal,
};
