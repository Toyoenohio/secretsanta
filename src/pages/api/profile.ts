import type { APIRoute } from 'astro';
import { sql } from '../../lib/db';
import { getCurrentUser } from '../../lib/auth';

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
    if (!name) {
      return new Response(JSON.stringify({ error: 'El nombre es obligatorio.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const nickname = (body.nickname || '').trim() || null;
    const avatar = (body.avatar || 'SS').trim();
    const phone = (body.phone || '').trim() || null;
    const shipping_address = (body.shipping_address || '').trim() || null;
    const likes = (body.likes || '').trim() || null;
    const dislikes = (body.dislikes || '').trim() || null;
    const shirt_size = (body.shirt_size || '').trim() || null;
    const pants_size = (body.pants_size || '').trim() || null;
    const shoe_size = (body.shoe_size || '').trim() || null;

    await sql`
      UPDATE users
      SET
        name = ${name},
        nickname = ${nickname},
        avatar = ${avatar},
        phone = ${phone},
        shipping_address = ${shipping_address},
        likes = ${likes},
        dislikes = ${dislikes},
        shirt_size = ${shirt_size},
        pants_size = ${pants_size},
        shoe_size = ${shoe_size}
      WHERE id = ${user.id}
    `;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return new Response(JSON.stringify({ error: 'No se pudo actualizar el perfil.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
