import crypto from 'node:crypto';
import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { hashPassword } from '../../../lib/auth';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const MIN_LARGO = 8;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    const password = String(body.password || '');

    if (!token) return json({ error: 'Falta el token del enlace.' }, 400);
    if (password.length < MIN_LARGO) {
      return json({ error: `La contraseña necesita al menos ${MIN_LARGO} caracteres.` }, 400);
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const filas = await sql`
      SELECT id, user_id, expires_at, used_at
      FROM password_resets
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;

    if (filas.length === 0) return json({ error: 'El enlace no es válido.' }, 400);

    const fila = filas[0];
    if (fila.used_at) return json({ error: 'Ese enlace ya se usó. Pedí uno nuevo.' }, 400);
    if (new Date(fila.expires_at).getTime() < Date.now()) {
      return json({ error: 'El enlace venció. Pedí uno nuevo.' }, 400);
    }

    const passwordHash = hashPassword(password);

    await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${fila.user_id}`;
    await sql`UPDATE password_resets SET used_at = now() WHERE id = ${fila.id}`;

    // Al cambiar la contraseña se cierran todas las sesiones abiertas.
    await sql`DELETE FROM sessions WHERE user_id = ${fila.user_id}`;

    return json({ ok: true, mensaje: 'Contraseña actualizada. Ya podés entrar con la nueva.' });
  } catch (err) {
    console.error('[reset] error', err);
    return json({ error: 'No se pudo cambiar la contraseña.' }, 500);
  }
};
