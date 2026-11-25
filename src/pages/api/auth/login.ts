import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { createSession, verifyPassword } from '../../../lib/auth';
import { sendMail, plantillaAvisoLogin, fechaVenezuela } from '../../../lib/mail';

function describirDispositivo(ua: string): string {
  if (!ua) return 'No identificado';
  const navegador = /Edg\//i.test(ua) ? 'Edge'
    : /OPR\//i.test(ua) ? 'Opera'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Safari\//i.test(ua) ? 'Safari'
    : '';
  const sistema = /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux'
    : '';
  if (!navegador && !sistema) return 'No identificado';
  return [navegador || 'Navegador', sistema || 'sistema desconocido'].join(' · ');
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
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

    // Aviso de ingreso: se dispara sin bloquear la respuesta y sin poder
    // tumbar el login si Resend falla.
    try {
      const ip =
        request.headers.get('cf-connecting-ip') ||
        (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
        clientAddress ||
        'desconocida';
      const ua = request.headers.get('user-agent') || '';
      const dispositivo = describirDispositivo(ua);
      const { html, text } = plantillaAvisoLogin({
        nombre: user.name || '',
        email: user.email,
        cuando: fechaVenezuela(),
        ip,
        dispositivo,
      });
      void sendMail({ to: user.email, subject: 'Entraste a tu cuenta · Amigo Secreto', html, text });
    } catch (err) {
      console.error('[login] aviso de correo falló', err);
    }

    // Al entrar, ir directo a la sala: primero la que tiene sorteo activo,
    // después la más reciente. Sin salas, al inicio con el estado vacío.
    const salas = await sql`
      SELECT r.code
      FROM room_members rm
      JOIN rooms r ON r.id = rm.room_id
      WHERE rm.user_id = ${user.id}
      ORDER BY (r.status = 'drawn') DESC, r.created_at DESC
      LIMIT 1
    `;

    return new Response(
      JSON.stringify({
        ok: true,
        user: { id: user.id, name: user.name, email: user.email },
        redirect: salas.length > 0 ? `/rooms/${salas[0].code}` : '/',
      }),
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
