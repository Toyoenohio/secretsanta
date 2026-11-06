import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/auth';
import { computeSecretSantaDraw } from '../../../../lib/draw';

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
    SELECT id, organizer_id, status
    FROM rooms
    WHERE UPPER(code) = ${code}
    LIMIT 1
  `;

  if (rooms.length === 0) {
    return new Response(JSON.stringify({ error: 'Sala no encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const room = rooms[0];
  if (room.organizer_id !== user.id) {
    return new Response(
      JSON.stringify({ error: 'Solo el organizador de la sala puede iniciar o reiniciar el sorteo.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'draw';

    if (action === 'reset') {
      await sql`
        UPDATE room_members
        SET assigned_receiver_id = NULL, card_number = NULL, has_revealed = FALSE, revealed_at = NULL
        WHERE room_id = ${room.id}
      `;
      await sql`
        UPDATE rooms
        SET status = 'open', drawn_at = NULL
        WHERE id = ${room.id}
      `;
      await sql`
        DELETE FROM anonymous_messages WHERE room_id = ${room.id}
      `;
      return new Response(JSON.stringify({ ok: true, status: 'open' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch all participants in the room
    const members = await sql`
      SELECT user_id FROM room_members WHERE room_id = ${room.id} ORDER BY joined_at ASC
    `;

    if (members.length < 2) {
      return new Response(
        JSON.stringify({
          error: 'Se necesitan al menos 2 participantes unidos en la sala para habilitar el sorteo.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const exclusions = await sql`
      SELECT giver_id, excluded_receiver_id
      FROM room_exclusions
      WHERE room_id = ${room.id}
    `;

    const memberIds = members.map((m: any) => m.user_id);
    const assignment = computeSecretSantaDraw(
      memberIds,
      exclusions.map((e: any) => ({
        giver_id: e.giver_id,
        excluded_receiver_id: e.excluded_receiver_id,
      }))
    );

    if (!assignment) {
      return new Response(
        JSON.stringify({
          error:
            'No es posible generar un sorteo donde nadie quede sin elegir o sin ser elegido con las exclusiones actuales. Por favor elimina alguna exclusión o invita a más participantes.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Save the verified permutation so every single member has both a giver and a receiver
    for (const giverId of memberIds) {
      const receiverId = assignment[giverId];
      await sql`
        UPDATE room_members
        SET
          assigned_receiver_id = ${receiverId},
          card_number = NULL,
          has_revealed = FALSE,
          revealed_at = NULL
        WHERE room_id = ${room.id} AND user_id = ${giverId}
      `;
    }

    await sql`
      UPDATE rooms
      SET status = 'drawn', drawn_at = NOW()
      WHERE id = ${room.id}
    `;

    return new Response(JSON.stringify({ ok: true, status: 'drawn', totalMembers: memberIds.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Draw error:', err);
    return new Response(JSON.stringify({ error: 'Error al ejecutar el sorteo.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
