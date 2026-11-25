import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/auth';

export const POST: APIRoute = async ({ params, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }

  const code = (params.code || '').toUpperCase();

  try {
    const salas = await sql`
      SELECT id, organizer_id, status FROM rooms WHERE UPPER(code) = ${code} LIMIT 1
    `;

    if (salas.length === 0) {
      return new Response(JSON.stringify({ error: 'Sala no encontrada' }), { status: 404 });
    }

    const sala = salas[0];

    if (sala.organizer_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'Eres quien organiza: puedes eliminar la sala desde aquí.' }),
        { status: 400 }
      );
    }

    if (sala.status !== 'open') {
      return new Response(
        JSON.stringify({ error: 'El sorteo ya se hizo. Pídele a quien organiza que reabra las inscripciones.' }),
        { status: 400 }
      );
    }

    const salida = await sql`
      DELETE FROM room_members
      WHERE room_id = ${sala.id} AND user_id = ${user.id}
      RETURNING user_id
    `;

    if (salida.length === 0) {
      return new Response(JSON.stringify({ error: 'No estabas en esta sala.' }), { status: 400 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Salir de sala error:', err);
    return new Response(JSON.stringify({ error: 'No se pudo salir de la sala.' }), { status: 500 });
  }
};
