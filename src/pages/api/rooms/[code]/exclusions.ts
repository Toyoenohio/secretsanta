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
    SELECT id, organizer_id, status FROM rooms WHERE UPPER(code) = ${code} LIMIT 1
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
      JSON.stringify({ error: 'Solo el organizador de la sala puede gestionar exclusiones.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (room.status !== 'open') {
    return new Response(
      JSON.stringify({ error: 'No puedes agregar exclusiones cuando el sorteo ya está activo.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const giverId = body.giver_id;
    const excludedReceiverId = body.excluded_receiver_id;
    const bidirectional = Boolean(body.bidirectional ?? true);
    const reason = (body.reason || '').trim() || null;

    if (!giverId || !excludedReceiverId || giverId === excludedReceiverId) {
      return new Response(
        JSON.stringify({ error: 'Selecciona dos participantes distintos para la exclusión.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if adding this exclusion still allows a valid draw if there are >= 3 members
    const members = await sql`SELECT user_id FROM room_members WHERE room_id = ${room.id}`;
    const existingExclusions = await sql`
      SELECT giver_id, excluded_receiver_id FROM room_exclusions WHERE room_id = ${room.id}
    `;

    const testExclusions = [
      ...existingExclusions.map((e: any) => ({
        giver_id: e.giver_id,
        excluded_receiver_id: e.excluded_receiver_id,
      })),
      { giver_id: giverId, excluded_receiver_id: excludedReceiverId },
    ];
    if (bidirectional) {
      testExclusions.push({ giver_id: excludedReceiverId, excluded_receiver_id: giverId });
    }

    if (members.length >= 2) {
      const memberIds = members.map((m: any) => m.user_id);
      const validTest = computeSecretSantaDraw(memberIds, testExclusions);
      if (!validTest) {
        return new Response(
          JSON.stringify({
            error:
              'Con los participantes actuales, esta exclusión haría matemáticamente imposible que todos tengan Amigo Secreto sin que nadie quede fuera. Espera a que se unan más personas o ajusta las reglas.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    await sql`
      INSERT INTO room_exclusions (room_id, giver_id, excluded_receiver_id, reason)
      VALUES (${room.id}, ${giverId}, ${excludedReceiverId}, ${reason})
      ON CONFLICT (room_id, giver_id, excluded_receiver_id) DO NOTHING
    `;

    if (bidirectional) {
      await sql`
        INSERT INTO room_exclusions (room_id, giver_id, excluded_receiver_id, reason)
        VALUES (${room.id}, ${excludedReceiverId}, ${giverId}, ${reason})
        ON CONFLICT (room_id, giver_id, excluded_receiver_id) DO NOTHING
      `;
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Add exclusion error:', err);
    return new Response(JSON.stringify({ error: 'Error al guardar exclusión.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const code = (params.code || '').toUpperCase();
  const rooms = await sql`
    SELECT id, organizer_id, status FROM rooms WHERE UPPER(code) = ${code} LIMIT 1
  `;

  if (rooms.length === 0 || rooms[0].organizer_id !== user.id) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const exclusionId = body.id;

    await sql`
      DELETE FROM room_exclusions
      WHERE id = ${exclusionId} AND room_id = ${rooms[0].id}
    `;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Delete exclusion error:', err);
    return new Response(JSON.stringify({ error: 'No se pudo eliminar la exclusión.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
