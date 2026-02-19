#!/usr/bin/env node
// TCP proxy that bridges local connections to Tailscale nodes via `tailscale nc`.
// Required because Tailscale userspace networking (no TUN) cannot route 100.x.x.x
// traffic directly — only the Tailscale daemon can establish connections.

const net = require('net');
const { spawn } = require('child_process');

const PORT = parseInt(process.env.TS_PROXY_PORT || '8901', 10);
const TARGET_HOST = process.env.TS_PROXY_TARGET_HOST || 'ai';
const TARGET_PORT = process.env.TS_PROXY_TARGET_PORT || '80';
const TAILSCALE_BIN = '/usr/local/bin/tailscale';

let activeConnections = 0;

const server = net.createServer(socket => {
  activeConnections++;
  const id = `${socket.remoteAddress}:${socket.remotePort}`;

  const nc = spawn(TAILSCALE_BIN, ['nc', TARGET_HOST, TARGET_PORT], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  socket.pipe(nc.stdin);
  nc.stdout.pipe(socket);

  nc.stderr.on('data', d => {
    console.error(`[ts-proxy] nc stderr (${id}): ${d.toString().trim()}`);
  });

  const cleanup = () => {
    activeConnections--;
    socket.destroy();
    nc.kill();
  };

  socket.on('close', cleanup);
  socket.on('error', cleanup);
  nc.on('close', () => { socket.destroy(); activeConnections--; });
  nc.on('error', err => {
    console.error(`[ts-proxy] nc error (${id}): ${err.message}`);
    socket.destroy();
    activeConnections--;
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[ts-proxy] Listening on 127.0.0.1:${PORT} -> tailscale nc ${TARGET_HOST} ${TARGET_PORT}`);
});

server.on('error', err => {
  console.error(`[ts-proxy] Server error: ${err.message}`);
  process.exit(1);
});
