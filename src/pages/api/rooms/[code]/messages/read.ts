import type { APIRoute } from 'astro';
import { sql } from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth';

export const POST: APIRoute = async ({ params, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }

  const code = (params.code || '').toUpperCase();

  try {
    const marcadas = await sql`
      UPDATE anonymous_messages m
      SET read_at = now()
      FROM rooms r
      WHERE m.room_id = r.id
        AND UPPER(r.code) = ${code}
        AND m.receiver_id = ${user.id}
        AND m.read_at IS NULL
      RETURNING m.id
    `;
    return new Response(JSON.stringify({ ok: true, marcadas: marcadas.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Marcar leídas error:', err);
    return new Response(JSON.stringify({ error: 'No se pudieron marcar las notas' }), { status: 500 });
  }
};
