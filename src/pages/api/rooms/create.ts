import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { generateInviteCode, getCurrentUser } from '../../../lib/auth';

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
    const name = (body.name || '').trim();
    const description = (body.description || '').trim() || null;
    const exchange_date = body.exchange_date || null;
    const budget_min = body.budget_min !== '' && body.budget_min != null ? Number(body.budget_min) : null;
    const budget_max = body.budget_max !== '' && body.budget_max != null ? Number(body.budget_max) : null;
    const currency = (body.currency || 'USD').trim().toUpperCase();

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Por favor ingresa un nombre para la sala o grupo.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let code = generateInviteCode(name);
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await sql`SELECT id FROM rooms WHERE code = ${code} LIMIT 1`;
      if (exists.length === 0) break;
      code = generateInviteCode('SANTA');
    }

    const created = await sql`
      INSERT INTO rooms (
        code, name, description, exchange_date,
        budget_min, budget_max, currency, organizer_id, status
      )
      VALUES (
        ${code}, ${name}, ${description}, ${exchange_date},
        ${budget_min}, ${budget_max}, ${currency}, ${user.id}, 'open'
      )
      RETURNING id, code, name
    `;

    const room = created[0];

    // Automatically add the organizer as the first participant in the room
    await sql`
      INSERT INTO room_members (room_id, user_id)
      VALUES (${room.id}, ${user.id})
      ON CONFLICT (room_id, user_id) DO NOTHING
    `;

    return new Response(JSON.stringify({ ok: true, room }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Create room error:', err);
    return new Response(JSON.stringify({ error: 'No se pudo crear la sala.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
