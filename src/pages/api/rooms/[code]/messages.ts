import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/auth';
import { enviarPush } from '../../../../lib/push';

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const code = (params.code || '').toUpperCase();
  const rooms = await sql`
    SELECT id, status FROM rooms WHERE UPPER(code) = ${code} LIMIT 1
  `;

  if (rooms.length === 0 || rooms[0].status !== 'drawn') {
    return new Response(JSON.stringify({ error: 'El sorteo debe estar activo para enviar mensajes.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const room = rooms[0];

  try {
    const body = await request.json();
    const content = (body.content || '').trim();
    const role: 'santa' | 'giftee' = body.role === 'giftee' ? 'giftee' : 'santa';

    if (!content) {
      return new Response(JSON.stringify({ error: 'Escribe un mensaje antes de enviar.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let receiverId: string | null = null;

    if (role === 'santa') {
      // User is writing AS Secret Santa TO their assigned giftee
      const row = await sql`
        SELECT assigned_receiver_id
        FROM room_members
        WHERE room_id = ${room.id} AND user_id = ${user.id}
        LIMIT 1
      `;
      if (row.length === 0 || !row[0].assigned_receiver_id) {
        return new Response(JSON.stringify({ error: 'Asignación no encontrada.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      receiverId = row[0].assigned_receiver_id;
    } else {
      // User is writing AS Giftee TO the anonymous Secret Santa who drew them
      const row = await sql`
        SELECT user_id
        FROM room_members
        WHERE room_id = ${room.id} AND assigned_receiver_id = ${user.id}
        LIMIT 1
      `;
      if (row.length === 0) {
        return new Response(JSON.stringify({ error: 'Tu Amigo Secreto no fue encontrado.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      receiverId = row[0].user_id;
    }

    const inserted = await sql`
      INSERT INTO anonymous_messages (room_id, sender_id, receiver_id, sender_role, content)
      VALUES (${room.id}, ${user.id}, ${receiverId}, ${role}, ${content})
      RETURNING id, sender_role, content, created_at
    `;

    const savedMsg = inserted[0];

    // Aviso push a quien recibe la nota (no hay chat en tiempo real)
    if (savedMsg && receiverId) {
      try {
        await enviarPush(receiverId, {
          title: 'Tienes una nota en la bota',
          body: content.length > 90 ? content.slice(0, 87) + '…' : content,
          url: `/rooms/${code.toLowerCase()}`,
          tag: `nota-${room.id}`,
        });
      } catch (err) {
        console.error('Push de nota falló:', err);
      }
    }

    return new Response(JSON.stringify({ ok: true, message: savedMsg }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Send anonymous message error:', err);
    return new Response(JSON.stringify({ error: 'No se pudo enviar el mensaje anónimo.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
