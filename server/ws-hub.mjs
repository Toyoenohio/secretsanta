// Hub de WebSocket para producción.
//
// El original (src/lib/ws-hub.ts) está enganchado SOLO desde el plugin de Vite,
// que corre en `astro dev` y `astro preview`. En el build de producción el
// endpoint /ws/chat no existía. Esta es la misma lógica, en JS plano, para que
// el servidor standalone la pueda montar sobre el HTTP server real.
//
// Protocolo: cliente conecta a /ws/chat?room=CODE con la cookie ss_session.
//   -> {type:'connected', roomCode}
//   -> {type:'chat_message', role:'santa'|'giftee', content}
//   -> {type:'typing', role, isTyping}
//   <- {type:'new_message', channel, message}
//   <- {type:'typing', channel, senderLabel, isTyping}

import { WebSocketServer, WebSocket } from 'ws';
import { neon } from '@neondatabase/serverless';

let sqlClient = null;
function sql(strings, ...params) {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient(strings, ...params);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const rechazar = (socket, code, texto) => {
  try { socket.write(`HTTP/1.1 ${code} ${texto}\r\n\r\n`); } catch {}
  try { socket.destroy(); } catch {}
};

export function crearHub() {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set();

  function broadcastChatMessage({ roomId, santaUserId, gifteeUserId, message }) {
    const limpio = {
      id: message.id,
      sender_role: message.sender_role,
      content: message.content,
      created_at: message.created_at
    };
    for (const c of clients) {
      if (c.ws.readyState !== WebSocket.OPEN || c.roomId !== roomId) continue;
      if (c.userId === santaUserId) {
        c.ws.send(JSON.stringify({ type: 'new_message', channel: 'with_my_giftee', message: limpio }));
      }
      if (c.userId === gifteeUserId) {
        c.ws.send(JSON.stringify({ type: 'new_message', channel: 'with_my_santa', message: limpio }));
      }
    }
  }

  wss.on('connection', (ws, info) => {
    clients.add(info);
    ws.send(JSON.stringify({ type: 'connected', roomCode: info.roomCode }));

    ws.on('message', async (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === 'typing') {
          const role = data.role === 'giftee' ? 'giftee' : 'santa';
          const isTyping = Boolean(data.isTyping);

          if (role === 'santa' && info.assignedReceiverId) {
            for (const t of clients) {
              if (t.ws.readyState === WebSocket.OPEN && t.roomId === info.roomId && t.userId === info.assignedReceiverId) {
                t.ws.send(JSON.stringify({ type: 'typing', channel: 'with_my_santa', senderLabel: 'Tu Amigo Secreto', isTyping }));
              }
            }
          }
          if (role === 'giftee' && info.mySantaUserId) {
            for (const t of clients) {
              if (t.ws.readyState === WebSocket.OPEN && t.roomId === info.roomId && t.userId === info.mySantaUserId) {
                t.ws.send(JSON.stringify({ type: 'typing', channel: 'with_my_giftee', senderLabel: 'Tu Asignado', isTyping }));
              }
            }
          }
          return;
        }

        if (data.type === 'chat_message') {
          const content = (data.content || '').trim();
          const role = data.role === 'giftee' ? 'giftee' : 'santa';
          if (!content) return;

          let santaUserId, gifteeUserId, receiverId;
          if (role === 'santa') {
            if (!info.assignedReceiverId) return;
            santaUserId = info.userId;
            gifteeUserId = info.assignedReceiverId;
            receiverId = info.assignedReceiverId;
          } else {
            if (!info.mySantaUserId) return;
            santaUserId = info.mySantaUserId;
            gifteeUserId = info.userId;
            receiverId = info.mySantaUserId;
          }

          const inserted = await sql`
            INSERT INTO anonymous_messages (room_id, sender_id, receiver_id, sender_role, content)
            VALUES (${info.roomId}, ${info.userId}, ${receiverId}, ${role}, ${content})
            RETURNING id, sender_role, content, created_at
          `;

          if (inserted.length && santaUserId && gifteeUserId) {
            broadcastChatMessage({ roomId: info.roomId, santaUserId, gifteeUserId, message: inserted[0] });
          }
        }
      } catch (err) {
        console.error('[ws] error de mensaje:', err?.message || err);
      }
    });

    ws.on('close', () => clients.delete(info));
    ws.on('error', () => clients.delete(info));
  });

  async function handleUpgrade(req, socket, head) {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname !== '/ws/chat') return;

      const roomCode = (url.searchParams.get('room') || '').trim().toUpperCase();
      const token = parseCookies(req.headers.cookie || '')['ss_session'];
      if (!token || !roomCode) return rechazar(socket, 401, 'Unauthorized');

      const sesion = await sql`SELECT user_id FROM sessions WHERE token = ${token} AND expires_at > NOW() LIMIT 1`;
      if (!sesion.length) return rechazar(socket, 401, 'Unauthorized');
      const userId = sesion[0].user_id;

      const rooms = await sql`SELECT id, code, status FROM rooms WHERE UPPER(code) = ${roomCode} LIMIT 1`;
      if (!rooms.length || rooms[0].status !== 'drawn') return rechazar(socket, 403, 'Forbidden');
      const room = rooms[0];

      const miembros = await sql`SELECT user_id, assigned_receiver_id FROM room_members WHERE room_id = ${room.id}`;
      const mio = miembros.find((m) => m.user_id === userId);
      if (!mio) return rechazar(socket, 403, 'Forbidden');
      const miSanta = miembros.find((m) => m.assigned_receiver_id === userId);

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, {
          ws,
          userId,
          roomId: room.id,
          roomCode: room.code,
          assignedReceiverId: mio.assigned_receiver_id || null,
          mySantaUserId: miSanta ? miSanta.user_id : null
        });
      });
    } catch (err) {
      console.error('[ws] error de upgrade:', err?.message || err);
      try { socket.destroy(); } catch {}
    }
  }

  return { handleUpgrade, clients };
}
