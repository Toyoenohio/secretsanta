import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { createSession, hashPassword } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    const nickname = (body.nickname || '').trim() || null;
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const avatar = (body.avatar || 'SS').trim();
    const phone = (body.phone || '').trim() || null;
    const shipping_address = (body.shipping_address || '').trim() || null;
    const likes = (body.likes || '').trim() || null;
    const dislikes = (body.dislikes || '').trim() || null;
    const shirt_size = (body.shirt_size || '').trim() || null;
    const pants_size = (body.pants_size || '').trim() || null;
    const shoe_size = (body.shoe_size || '').trim() || null;

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Por favor completa tu nombre, correo y contraseña.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existing.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Ya existe una cuenta registrada con este correo electrónico.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const passwordHash = hashPassword(password);

    const inserted = await sql`
      INSERT INTO users (
        name, nickname, email, password_hash, avatar,
        phone, shipping_address, likes, dislikes,
        shirt_size, pants_size, shoe_size
      )
      VALUES (
        ${name}, ${nickname}, ${email}, ${passwordHash}, ${avatar},
        ${phone}, ${shipping_address}, ${likes}, ${dislikes},
        ${shirt_size}, ${pants_size}, ${shoe_size}
      )
      RETURNING id, name, email
    `;

    const user = inserted[0];
    await createSession(user.id, cookies);

    return new Response(JSON.stringify({ ok: true, user }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Register error:', err);
    return new Response(
      JSON.stringify({ error: 'Error al registrar usuario. Intenta nuevamente.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
