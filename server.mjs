// Servidor de producción: Astro en modo middleware + WebSocket de chat + estáticos.
//
// Dos cosas que el modo `middleware` NO hace por su cuenta y hay que resolver acá:
//   1. Servir dist/client (imágenes, iconos, manifest, service worker).
//   2. Montar el WebSocket de chat, que en desarrollo vive en el plugin de Vite.
//
// Uso:  node server.mjs
// Env:  DATABASE_URL, SESSION_SECRET, HOST, PORT (se leen de .env si no están)

import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// --- cargar .env antes de importar nada que lea process.env ---
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const linea of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*["']?([^"'\r\n]+)["']?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 4321);
const RAIZ_CLIENTE = path.resolve(process.cwd(), 'dist/client');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function servirEstatico(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  let ruta;
  try {
    ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return false;
  }
  if (ruta === '/') return false;

  const archivo = path.join(RAIZ_CLIENTE, ruta);
  // impedir salir del directorio de assets
  if (!archivo.startsWith(RAIZ_CLIENTE + path.sep)) return false;

  let stat;
  try {
    stat = fs.statSync(archivo);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;

  const ext = path.extname(archivo).toLowerCase();
  const cacheable = ruta.startsWith('/_astro/') || /\.(jpg|jpeg|png|webp|avif|gif|svg|woff2?)$/i.test(ruta);
  const cabeceras = {
    'content-type': TIPOS[ext] || 'application/octet-stream',
    'content-length': stat.size,
    // los assets con hash pueden cachearse para siempre; el resto, revalidar
    'cache-control': cacheable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate'
  };

  res.writeHead(200, cabeceras);
  if (req.method === 'HEAD') return res.end(), true;

  fs.createReadStream(archivo).pipe(res);
  return true;
}

const { handler } = await import('./dist/server/entry.mjs');
const { crearHub } = await import('./server/ws-hub.mjs');

const hub = crearHub();

const server = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, uptime: Math.round(process.uptime()) }));
  }
  if (servirEstatico(req, res)) return;
  return handler(req, res);
});

server.on('upgrade', (req, socket, head) => {
  if ((req.url || '').startsWith('/ws/chat')) {
    hub.handleUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[secretsanta] escuchando en http://${HOST}:${PORT}`);
  console.log(`[secretsanta] estáticos desde ${RAIZ_CLIENTE}`);
  console.log('[secretsanta] websocket en /ws/chat');
});

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    console.log(`[secretsanta] ${senal}, cerrando…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000);
  });
}
