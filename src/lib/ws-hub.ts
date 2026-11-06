import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { sql } from './db';

interface AuthenticatedClient {
  ws: WebSocket;
  userId: string;
  roomId: string;
  roomCode: string;
  assignedReceiverId: string | null;
  mySantaUserId: string | null;
}

interface WsHub {
  wss: WebSocketServer;
  clients: Set<AuthenticatedClient>;
  handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
  broadcastChatMessage: (params: {
    roomId: string;
    santaUserId: string;
    gifteeUserId: string;
    message: {
      id: string;
      sender_role: 'santa' | 'giftee';
      content: string;
      created_at: string;
    };
  }) => void;
}

function getSql() {
  return sql;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

export function getOrCreateWsHub(): WsHub {
  const g = globalThis as unknown as { __secretSantaWsHub?: WsHub };
  if (g.__secretSantaWsHub) {
    return g.__secretSantaWsHub;
  }

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<AuthenticatedClient>();

  const broadcastChatMessage: WsHub['broadcastChatMessage'] = ({
    roomId,
    santaUserId,
    gifteeUserId,
    message,
  }) => {
    // Sanitized message payload: NEVER includes sender_id or receiver_id so identity remains 100% secret
    const sanitizedMessage = {
      id: message.id,
      sender_role: message.sender_role,
      content: message.content,
      created_at: message.created_at,
    };

    for (const client of clients) {
      if (client.ws.readyState !== WebSocket.OPEN || client.roomId !== roomId) {
        continue;
      }

      // Deliver to the Secret Santa in their "with_my_giftee" channel
      if (client.userId === santaUserId) {
        client.ws.send(
          JSON.stringify({
            type: 'new_message',
            channel: 'with_my_giftee',
            message: sanitizedMessage,
          })
        );
      }

      // Deliver to the Giftee in their "with_my_santa" channel
      if (client.userId === gifteeUserId) {
        client.ws.send(
          JSON.stringify({
            type: 'new_message',
            channel: 'with_my_santa',
            message: sanitizedMessage,
          })
        );
      }
    }
  };

  wss.on('connection', (ws: WebSocket, clientInfo: AuthenticatedClient) => {
    clients.add(clientInfo);

    ws.send(
      JSON.stringify({
        type: 'connected',
        roomCode: clientInfo.roomCode,
      })
    );

    ws.on('message', async (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const sql = getSql();

        if (data.type === 'typing') {
          const role = data.role === 'giftee' ? 'giftee' : 'santa';
          const isTyping = Boolean(data.isTyping);

          // If Santa is typing to their assigned Giftee:
          if (role === 'santa' && clientInfo.assignedReceiverId) {
            for (const target of clients) {
              if (
                target.ws.readyState === WebSocket.OPEN &&
                target.roomId === clientInfo.roomId &&
                target.userId === clientInfo.assignedReceiverId
              ) {
                target.ws.send(
                  JSON.stringify({
                    type: 'typing',
                    channel: 'with_my_santa',
                    senderLabel: 'Tu Amigo Secreto',
                    isTyping,
                  })
                );
              }
            }
          }

          // If Giftee is typing back to their anonymous Secret Santa:
          if (role === 'giftee' && clientInfo.mySantaUserId) {
            for (const target of clients) {
              if (
                target.ws.readyState === WebSocket.OPEN &&
                target.roomId === clientInfo.roomId &&
                target.userId === clientInfo.mySantaUserId
              ) {
                target.ws.send(
                  JSON.stringify({
                    type: 'typing',
                    channel: 'with_my_giftee',
                    senderLabel: 'Tu Asignado',
                    isTyping,
                  })
                );
              }
            }
          }
          return;
        }

        if (data.type === 'chat_message') {
          const content = (data.content || '').trim();
          const role: 'santa' | 'giftee' = data.role === 'giftee' ? 'giftee' : 'santa';
          if (!content) return;

          let santaUserId: string | null = null;
          let gifteeUserId: string | null = null;
          let receiverId: string | null = null;

          if (role === 'santa') {
            if (!clientInfo.assignedReceiverId) return;
            santaUserId = clientInfo.userId;
            gifteeUserId = clientInfo.assignedReceiverId;
            receiverId = clientInfo.assignedReceiverId;
          } else {
            if (!clientInfo.mySantaUserId) return;
            santaUserId = clientInfo.mySantaUserId;
            gifteeUserId = clientInfo.userId;
            receiverId = clientInfo.mySantaUserId;
          }

          const inserted = await sql`
            INSERT INTO anonymous_messages (room_id, sender_id, receiver_id, sender_role, content)
            VALUES (${clientInfo.roomId}, ${clientInfo.userId}, ${receiverId}, ${role}, ${content})
            RETURNING id, sender_role, content, created_at
          `;

          if (inserted.length > 0 && santaUserId && gifteeUserId) {
            broadcastChatMessage({
              roomId: clientInfo.roomId,
              santaUserId,
              gifteeUserId,
              message: inserted[0] as any,
            });
          }
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(clientInfo);
    });

    ws.on('error', () => {
      clients.delete(clientInfo);
    });
  });

  const handleUpgrade = async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      if (urlObj.pathname !== '/ws/chat') {
        return;
      }

      const roomCode = (urlObj.searchParams.get('room') || '').trim().toUpperCase();
      const cookies = parseCookies(req.headers.cookie);
      const sessionToken = cookies['ss_session'];

      if (!sessionToken || !roomCode) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const sql = getSql();

      const sessionRows = await sql`
        SELECT user_id
        FROM sessions
        WHERE token = ${sessionToken} AND expires_at > NOW()
        LIMIT 1
      `;

      if (sessionRows.length === 0) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const userId = sessionRows[0].user_id as string;

      const roomRows = await sql`
        SELECT id, code, status
        FROM rooms
        WHERE UPPER(code) = ${roomCode}
        LIMIT 1
      `;

      if (roomRows.length === 0 || roomRows[0].status !== 'drawn') {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      const room = roomRows[0];

      // Find this user's membership and who their anonymous Secret Santa is
      const memberRows = await sql`
        SELECT user_id, assigned_receiver_id
        FROM room_members
        WHERE room_id = ${room.id}
      `;

      const myMember = memberRows.find((m: any) => m.user_id === userId);
      if (!myMember) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      const mySanta = memberRows.find((m: any) => m.assigned_receiver_id === userId);

      wss.handleUpgrade(req, socket, head, (ws) => {
        const clientInfo: AuthenticatedClient = {
          ws,
          userId,
          roomId: room.id,
          roomCode: room.code,
          assignedReceiverId: myMember.assigned_receiver_id || null,
          mySantaUserId: mySanta ? mySanta.user_id : null,
        };
        wss.emit('connection', ws, clientInfo);
      });
    } catch (err) {
      console.error('WS Upgrade error:', err);
      try {
        socket.destroy();
      } catch {}
    }
  };

  const hub: WsHub = {
    wss,
    clients,
    handleUpgrade,
    broadcastChatMessage,
  };

  g.__secretSantaWsHub = hub;
  return hub;
}
