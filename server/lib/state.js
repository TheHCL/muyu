'use strict';

const { sanitize, generate } = require('./nicknames');

// Map<ws, { clientId, nick, hits }>
const clients = new Map();

// globalTotal persists in-memory (resets on restart)
let globalTotal = 0;

const LEADERBOARD_SIZE = 10;
const RATE_LIMIT = 20; // max hits per second per client

// Rate limiter: Map<clientId, { count, resetAt }>
const rateLimits = new Map();

function addClient(ws, clientId, rawNick) {
  const nick = sanitize(rawNick) || generate();
  clients.set(ws, { clientId, nick, hits: 0 });
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
  if (rl.count > RATE_LIMIT) return null; // drop silently

  globalTotal++;
  client.hits++;
  return { globalTotal, nick: client.nick };
}

function setNick(ws, rawNick) {
  const client = clients.get(ws);
  if (!client) return null;
  const nick = sanitize(rawNick);
  if (!nick) return null;
  client.nick = nick;
  return nick;
}

function getOnlineCount() {
  return clients.size;
}

function getLeaderboard() {
  return Array.from(clients.values())
    .sort((a, b) => b.hits - a.hits)
    .slice(0, LEADERBOARD_SIZE)
    .map(({ nick, hits }) => ({ nick, hits }));
}

function getClientInfo(ws) {
  return clients.get(ws) || null;
}

function getGlobalTotal() {
  return globalTotal;
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
