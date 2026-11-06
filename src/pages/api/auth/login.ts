import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { createSession, verifyPassword } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Por favor ingresa tu correo y contraseña.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rows = await sql`
      SELECT id, name, email, password_hash
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;

    if (rows.length === 0 || !verifyPassword(password, rows[0].password_hash)) {
      return new Response(
        JSON.stringify({ error: 'Correo electrónico o contraseña incorrectos.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = rows[0];
    await createSession(user.id, cookies);

    return new Response(
      JSON.stringify({ ok: true, user: { id: user.id, name: user.name, email: user.email } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Login error:', err);
    return new Response(
      JSON.stringify({ error: 'Error al iniciar sesión.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
