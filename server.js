/**
 * server.js
 * - Serves the viewer website (public/) — no install needed on viewer side.
 * - Relays binary screen frames from the host's Python agent -> browser viewers.
 * - Relays control events (mouse/keyboard) from browser viewers -> host agent.
 *
 * No login system. A random PIN identifies each session/room.
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// code -> { hostWs, viewers: Set<ws> }
const rooms = new Map();

function generateCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(code));
  return code;
}

wss.on('connection', (ws) => {
  ws.role = null;
  ws.code = null;

  ws.on('message', (data, isBinary) => {
    // ---- Binary data = a screen frame, only ever sent by the host agent ----
    if (isBinary) {
      if (ws.role === 'host' && ws.code) {
        const room = rooms.get(ws.code);
        if (room) {
          for (const viewer of room.viewers) {
            if (viewer.readyState === WebSocket.OPEN) viewer.send(data);
          }
        }
      }
      return;
    }

    // ---- Text data = JSON control / signaling messages ----
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === 'host:register') {
      const code = generateCode();
      ws.role = 'host';
      ws.code = code;
      rooms.set(code, { hostWs: ws, viewers: new Set() });
      ws.send(JSON.stringify({ type: 'code', code }));
      console.log(`[host] room ${code} created`);
      return;
    }

    if (msg.type === 'viewer:join') {
      const room = rooms.get(msg.code);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid code or host offline' }));
        return;
      }
      ws.role = 'viewer';
      ws.code = msg.code;
      room.viewers.add(ws);
      ws.send(JSON.stringify({ type: 'joined' }));
      console.log(`[viewer] joined room ${msg.code}`);
      return;
    }

    if (msg.type === 'control') {
      // Forward mouse/keyboard event from viewer -> host agent
      const room = rooms.get(ws.code);
      if (room && room.hostWs.readyState === WebSocket.OPEN) {
        room.hostWs.send(JSON.stringify(msg));
      }
      return;
    }
  });

  ws.on('close', () => {
    if (ws.role === 'host' && ws.code) {
      const room = rooms.get(ws.code);
      if (room) {
        for (const viewer of room.viewers) {
          viewer.send(JSON.stringify({ type: 'host-left' }));
        }
      }
      rooms.delete(ws.code);
      console.log(`[host] room ${ws.code} closed`);
    } else if (ws.role === 'viewer' && ws.code) {
      const room = rooms.get(ws.code);
      if (room) room.viewers.delete(ws);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running: http://localhost:${PORT}`));
