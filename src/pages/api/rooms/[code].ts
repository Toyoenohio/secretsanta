import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/auth';

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }

  const code = (params.code || '').toUpperCase();

  try {
    const salas = await sql`
      SELECT id, organizer_id, name FROM rooms WHERE UPPER(code) = ${code} LIMIT 1
    `;

    if (salas.length === 0) {
      return new Response(JSON.stringify({ error: 'Sala no encontrada' }), { status: 404 });
    }

    const sala = salas[0];

    if (sala.organizer_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Solo quien organiza la sala puede eliminarla.' }),
        { status: 403 }
      );
    }

    // miembros, exclusiones y notas se van en cascada; las reservas de wishlist quedan liberadas
    await sql`DELETE FROM rooms WHERE id = ${sala.id}`;

    return new Response(JSON.stringify({ ok: true, eliminada: sala.name }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Eliminar sala error:', err);
    return new Response(JSON.stringify({ error: 'No se pudo eliminar la sala.' }), { status: 500 });
  }
};
