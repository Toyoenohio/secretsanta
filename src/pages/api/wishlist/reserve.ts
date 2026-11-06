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
    const itemId = body.itemId;
    const roomId = body.roomId || null;

    if (!itemId) {
      return new Response(JSON.stringify({ error: 'Falta el ID del deseo' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const items = await sql`
      SELECT id, user_id, reserved_by_user_id
      FROM wishlist_items
      WHERE id = ${itemId}
      LIMIT 1
    `;

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: 'Deseo no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const item = items[0];

    // Verify that the current user is indeed assigned as Secret Santa to item.user_id in at least one drawn room
    const assignmentCheck = await sql`
      SELECT id, room_id
      FROM room_members
      WHERE user_id = ${user.id}
        AND assigned_receiver_id = ${item.user_id}
        AND has_revealed = TRUE
      LIMIT 1
    `;

    if (assignmentCheck.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Solo el Amigo Secreto asignado puede marcar este regalo como comprado/elegido.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If already reserved by someone else, prevent overwriting
    if (item.reserved_by_user_id && item.reserved_by_user_id !== user.id) {
      return new Response(
        JSON.stringify({
          error: 'Otro Amigo Secreto (en otra sala) ya marcó este regalo como comprado.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Toggle reservation
    if (item.reserved_by_user_id === user.id) {
      await sql`
        UPDATE wishlist_items
        SET reserved_by_user_id = NULL, reserved_in_room_id = NULL, reserved_at = NULL
        WHERE id = ${itemId}
      `;
      return new Response(JSON.stringify({ ok: true, reserved: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      const targetRoomId = roomId || assignmentCheck[0].room_id;
      await sql`
        UPDATE wishlist_items
        SET
          reserved_by_user_id = ${user.id},
          reserved_in_room_id = ${targetRoomId},
          reserved_at = NOW()
        WHERE id = ${itemId}
      `;
      return new Response(JSON.stringify({ ok: true, reserved: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('Reserve wishlist item error:', err);
    return new Response(
      JSON.stringify({ error: 'Error al actualizar el estado del regalo.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
