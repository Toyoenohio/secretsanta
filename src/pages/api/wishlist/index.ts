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
    const title = (body.title || '').trim();
    const notes = (body.notes || '').trim() || null;
    let url = (body.url || '').trim() || null;
    const priority = ['high', 'medium', 'low'].includes(body.priority) ? body.priority : 'medium';
    const estimated_price = (body.estimated_price || '').trim() || null;

    if (!title) {
      return new Response(
        JSON.stringify({ error: 'Por favor escribe el nombre o descripción de tu deseo.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url && !/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    const rows = await sql`
      INSERT INTO wishlist_items (user_id, title, notes, url, priority, estimated_price)
      VALUES (${user.id}, ${title}, ${notes}, ${url}, ${priority}, ${estimated_price})
      RETURNING id, user_id, title, notes, url, priority, estimated_price, created_at
    `;

    return new Response(JSON.stringify({ ok: true, item: rows[0] }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Add wishlist item error:', err);
    return new Response(
      JSON.stringify({ error: 'Error al guardar el deseo en tu Wishlist.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const id = body.id;
    const title = (body.title || '').trim();
    const notes = (body.notes || '').trim() || null;
    let url = (body.url || '').trim() || null;
    const priority = ['high', 'medium', 'low'].includes(body.priority) ? body.priority : 'medium';
    const estimated_price = (body.estimated_price || '').trim() || null;

    if (!id || !title) {
      return new Response(
        JSON.stringify({ error: 'Datos incompletos para actualizar el deseo.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url && !/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    const rows = await sql`
      UPDATE wishlist_items
      SET
        title = ${title},
        notes = ${notes},
        url = ${url},
        priority = ${priority},
        estimated_price = ${estimated_price}
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING id, user_id, title, notes, url, priority, estimated_price, created_at
    `;

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Deseo no encontrado.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, item: rows[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Update wishlist item error:', err);
    return new Response(
      JSON.stringify({ error: 'Error al actualizar el deseo.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const itemId = body.id;

    if (!itemId) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await sql`
      DELETE FROM wishlist_items
      WHERE id = ${itemId} AND user_id = ${user.id}
    `;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Delete wishlist item error:', err);
    return new Response(JSON.stringify({ error: 'No se pudo eliminar el deseo.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
