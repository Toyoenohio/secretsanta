import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const rawCode = (body.code || '').trim().toUpperCase();

    if (!rawCode) {
      return new Response(
        JSON.stringify({ error: 'Ingresa el código de invitación de la sala.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rooms = await sql`
      SELECT id, code, name, status
      FROM rooms
      WHERE UPPER(code) = ${rawCode}
      LIMIT 1
    `;

    if (rooms.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No encontramos ninguna sala con ese código de invitación.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const room = rooms[0];

    // Check if already a member
    const existingMember = await sql`
      SELECT id FROM room_members WHERE room_id = ${room.id} AND user_id = ${user.id} LIMIT 1
    `;

    if (existingMember.length > 0) {
      return new Response(JSON.stringify({ ok: true, room, alreadyMember: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (room.status !== 'open') {
      return new Response(
        JSON.stringify({
          error:
            'El sorteo de esta sala ya fue realizado y las inscripciones están cerradas. Pide al organizador que reabra la sala si faltabas tú.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await sql`
      INSERT INTO room_members (room_id, user_id)
      VALUES (${room.id}, ${user.id})
      ON CONFLICT (room_id, user_id) DO NOTHING
    `;

    return new Response(JSON.stringify({ ok: true, room }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Join room error:', err);
    return new Response(JSON.stringify({ error: 'Error al unirse a la sala.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
