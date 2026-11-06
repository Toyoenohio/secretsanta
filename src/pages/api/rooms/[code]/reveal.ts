import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/auth';

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

  if (rooms.length === 0) {
    return new Response(JSON.stringify({ error: 'Sala no encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const room = rooms[0];
  if (room.status !== 'drawn') {
    return new Response(
      JSON.stringify({ error: 'El sorteo aún no ha sido habilitado por el organizador.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const pickedCard = Number(body.cardNumber) || 1;

    // Check current member record
    const members = await sql`
      SELECT id, assigned_receiver_id, has_revealed, card_number
      FROM room_members
      WHERE room_id = ${room.id} AND user_id = ${user.id}
      LIMIT 1
    `;

    if (members.length === 0) {
      return new Response(JSON.stringify({ error: 'No eres miembro de esta sala.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const myMember = members[0];
    if (!myMember.assigned_receiver_id) {
      return new Response(
        JSON.stringify({ error: 'Error en la asignación. Pide al organizador reiniciar el sorteo.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!myMember.has_revealed) {
      // Check if that visual card_number was already taken; if so, assign the next available card number
      const takenCards = await sql`
        SELECT card_number FROM room_members
        WHERE room_id = ${room.id} AND card_number IS NOT NULL
      `;
      const usedSet = new Set(takenCards.map((c: any) => Number(c.card_number)));
      let finalCard = pickedCard;
      if (usedSet.has(finalCard)) {
        finalCard = 1;
        while (usedSet.has(finalCard)) finalCard++;
      }

      await sql`
        UPDATE room_members
        SET has_revealed = TRUE, card_number = ${finalCard}, revealed_at = NOW()
        WHERE id = ${myMember.id}
      `;
    }

    const receiverRows = await sql`
      SELECT
        id, name, nickname, avatar, phone, shipping_address,
        likes, dislikes, shirt_size, pants_size, shoe_size
      FROM users
      WHERE id = ${myMember.assigned_receiver_id}
      LIMIT 1
    `;

    return new Response(
      JSON.stringify({
        ok: true,
        receiver: receiverRows[0],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Reveal card error:', err);
    return new Response(JSON.stringify({ error: 'Error al abrir tu papelito.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
