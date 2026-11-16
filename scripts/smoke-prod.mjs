import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { io } = require('../apps/web/node_modules/socket.io-client');

const API_URL = process.env.API_URL?.trim().replace(/\/+$/, '');
const WEB_URL = process.env.WEB_URL?.trim().replace(/\/+$/, '');
const SOCKET_URL = (process.env.SOCKET_URL?.trim() || API_URL || '').replace(/\/+$/, '');

if (!API_URL || !WEB_URL || !SOCKET_URL) {
  console.error(
    'Missing required env vars. Set API_URL, WEB_URL (and optionally SOCKET_URL) before running.',
  );
  process.exit(1);
}

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}`);
}

function extractSessionCookie(res) {
  const getSetCookie = res.headers.getSetCookie?.bind(res.headers);
  const cookies = getSetCookie ? getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  for (const header of cookies) {
    const firstPart = header.split(';')[0]?.trim();
    if (firstPart?.startsWith('bg_session=')) {
      return firstPart;
    }
  }
  return null;
}

function connectSocket(cookiePair, requireWss) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      extraHeaders: {
        cookie: cookiePair,
        origin: WEB_URL,
      },
      reconnection: false,
      timeout: 10000,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Timed out waiting for auth:ready'));
    }, 10000);

    socket.on('auth:ready', (payload) => {
      clearTimeout(timer);
      const transport = socket.io?.engine?.transport?.name;
      if (requireWss && transport !== 'websocket') {
        socket.disconnect();
        reject(new Error(`Expected websocket transport, got "${transport}"`));
        return;
      }
      resolve({ socket, payload, transport });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(err);
    });
  });
}

async function main() {
  // 1. Server /health = 200
  try {
    const res = await fetch(`${API_URL}/health`);
    const body = await res.json().catch(() => ({}));
    if (res.status === 200 && body.ok) {
      record('Server /health = 200', true, `status=${res.status}`);
    } else {
      record('Server /health = 200', false, `status=${res.status} body=${JSON.stringify(body)}`);
    }
  } catch (err) {
    record('Server /health = 200', false, err instanceof Error ? err.message : String(err));
  }

  // 2. Web home page = 200
  try {
    const res = await fetch(`${WEB_URL}/`);
    if (res.status === 200) {
      record('Web home page = 200', true, `status=${res.status}`);
    } else {
      record('Web home page = 200', false, `status=${res.status}`);
    }
  } catch (err) {
    record('Web home page = 200', false, err instanceof Error ? err.message : String(err));
  }

  // 3. Register + login flow sets the session
  const suffix = crypto.randomBytes(4).toString('hex');
  const email = `smoke_${suffix}@example.com`;
  const username = `Smoke_${suffix}`;
  const password = `Sm0ke!${crypto.randomBytes(8).toString('hex')}`;
  let sessionCookie = null;

  try {
    const regRes = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
      body: JSON.stringify({ email, password, username, avatarId: 'fox' }),
    });
    const regCookie = extractSessionCookie(regRes);
    if (regRes.status !== 201 || !regCookie) {
      const errBody = await regRes.text().catch(() => '');
      throw new Error(`Register failed: status=${regRes.status} body=${errBody}`);
    }

    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: regCookie, Origin: WEB_URL },
    });

    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
      body: JSON.stringify({ email, password }),
    });
    const loginCookie = extractSessionCookie(loginRes);
    if (loginRes.status !== 200 || !loginCookie) {
      const errBody = await loginRes.text().catch(() => '');
      throw new Error(`Login failed: status=${loginRes.status} body=${errBody}`);
    }

    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Cookie: loginCookie, Origin: WEB_URL },
    });
    if (meRes.status !== 200) {
      throw new Error(`/api/auth/me failed: status=${meRes.status}`);
    }

    sessionCookie = loginCookie;
    record('Register + login flow sets session', true, `user=${username}`);
  } catch (err) {
    record(
      'Register + login flow sets session',
      false,
      err instanceof Error ? err.message : String(err),
    );
  }

  // 4. Authenticated Socket.io connects over WSS
  const requireWss = SOCKET_URL.startsWith('https://') || SOCKET_URL.startsWith('wss://');
  if (!sessionCookie) {
    record('Authenticated Socket.io connects over WSS', false, 'Skipped (no session cookie)');
    record('Socket.io reconnect works', false, 'Skipped (no session cookie)');
  } else {
    let firstSocket = null;
    try {
      const conn1 = await connectSocket(sessionCookie, requireWss);
      firstSocket = conn1.socket;
      record(
        'Authenticated Socket.io connects over WSS',
        true,
        `transport=${conn1.transport} user=${conn1.payload?.username}`,
      );
      firstSocket.disconnect();
    } catch (err) {
      record(
        'Authenticated Socket.io connects over WSS',
        false,
        err instanceof Error ? err.message : String(err),
      );
    }

    // 5. Reconnect works
    try {
      const conn2 = await connectSocket(sessionCookie, requireWss);
      record(
        'Socket.io reconnect works',
        true,
        `transport=${conn2.transport} user=${conn2.payload?.username}`,
      );
      conn2.socket.disconnect();
    } catch (err) {
      record('Socket.io reconnect works', false, err instanceof Error ? err.message : String(err));
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

main();
