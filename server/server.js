'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const state = require('./lib/state');

const PORT = process.env.PORT || 3000;

// HTTP server (health check for Railway)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('木魚 server running\n');
});

const wss = new WebSocketServer({ server });

// --- Broadcast helpers ---

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastAll(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });
}

// Throttled broadcast: buffers calls within `delay` ms, fires once
const throttleTimers = new Map();
function broadcastThrottled(key, delay, buildMsg) {
  if (throttleTimers.has(key)) return;
  throttleTimers.set(key, setTimeout(() => {
    throttleTimers.delete(key);
    broadcastAll(buildMsg());
  }, delay));
}

// Leaderboard broadcast every 5 seconds
setInterval(() => {
  broadcastAll({
    type: 'leaderboard_update',
    leaderboard: state.getLeaderboard(),
  });
}, 5000);

// Keepalive ping every 30s to prevent Render proxy from cutting idle connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.ping();
  });
}, 30000);

// --- Connection handler ---

wss.on('connection', (ws, req) => {
  let joined = false;

  // If no join within 10s, close
  const joinTimeout = setTimeout(() => {
    if (!joined) ws.close();
  }, 10000);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'join': {
        if (joined) return;
        joined = true;
        clearTimeout(joinTimeout);

        const clientId = typeof msg.clientId === 'string' ? msg.clientId.slice(0, 64) : 'anon';
        const { nick } = state.addClient(ws, clientId, msg.nick);

        // Send init state
        send(ws, {
          type: 'init',
          globalTotal: state.getGlobalTotal(),
          onlineCount: state.getOnlineCount(),
          leaderboard: state.getLeaderboard(),
          yourHits: state.getClientInfo(ws)?.hits ?? 0,
          nick,
        });

        // Broadcast updated presence
        broadcastAll({ type: 'presence', onlineCount: state.getOnlineCount() });
        break;
      }

      case 'hit': {
        if (!joined) return;
        const result = state.recordHit(ws);
        if (!result) return;

        broadcastThrottled('global_hit', 100, () => ({
          type: 'global_hit',
          globalTotal: state.getGlobalTotal(),
          nick: result.nick,
        }));
        break;
      }

      case 'set_nick': {
        if (!joined) return;
        const nick = state.setNick(ws, msg.nick);
        if (nick) send(ws, { type: 'nick_ack', nick });
        break;
      }
    }
  });

  ws.on('close', () => {
    clearTimeout(joinTimeout);
    state.removeClient(ws);
    broadcastAll({ type: 'presence', onlineCount: state.getOnlineCount() });
  });

  ws.on('error', () => {
    clearTimeout(joinTimeout);
    state.removeClient(ws);
  });
});

server.listen(PORT, () => {
  console.log(`木魚 server listening on port ${PORT}`);
});
