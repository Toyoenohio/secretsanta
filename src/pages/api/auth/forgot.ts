import crypto from 'node:crypto';
import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { sendMail, plantillaReset, mailConfig } from '../../../lib/mail';

const MINUTOS = 45;
const MAX_POR_EMAIL = 3;      // por hora
const MAX_POR_IP = 10;        // por hora
const VENTANA_MS = 60 * 60 * 1000;

// Límite en memoria: alcanza para una app de este tamaño y se reinicia con el
// servicio. No es un reemplazo de un rate-limit distribuido.
const intentos = new Map<string, number[]>();

function permitido(clave: string, max: number): boolean {
  const ahora = Date.now();
  const previos = (intentos.get(clave) || []).filter((t) => ahora - t < VENTANA_MS);
  if (previos.length >= max) {
    intentos.set(clave, previos);
    return false;
  }
  previos.push(ahora);
  intentos.set(clave, previos);
  return true;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    clientAddress ||
    'desconocida';

  // La respuesta es siempre la misma: no se revela si el correo existe.
  const respuestaGenerica = {
    ok: true,
    mensaje: 'Si ese correo tiene cuenta, te enviamos un enlace para cambiar la contraseña. Revisá también el spam.',
  };

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return json({ error: 'Ingresá un correo válido.' }, 400);

    if (!permitido(`email:${email}`, MAX_POR_EMAIL) || !permitido(`ip:${ip}`, MAX_POR_IP)) {
      // Misma forma de respuesta: el límite no delata existencia de cuentas.
      return json(respuestaGenerica);
    }

    const filas = await sql`
      SELECT id, name, email FROM users WHERE email = ${email} LIMIT 1
    `;
    if (filas.length === 0) return json(respuestaGenerica);

    const user = filas[0];
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expira = new Date(Date.now() + MINUTOS * 60 * 1000);

    // Un pedido nuevo invalida los anteriores.
    await sql`UPDATE password_resets SET used_at = now() WHERE user_id = ${user.id} AND used_at IS NULL`;
    await sql`
      INSERT INTO password_resets (user_id, token_hash, expires_at, requested_ip)
      VALUES (${user.id}, ${tokenHash}, ${expira.toISOString()}, ${ip})
    `;

    const { siteUrl } = mailConfig();
    const enlace = `${siteUrl}/reset/${token}`;
    const { html, text } = plantillaReset(user.name || '', enlace, MINUTOS);

    const envio = await sendMail({
      to: user.email,
      subject: 'Cambiar tu contraseña · Amigo Secreto',
      html,
      text,
    });

    if (!envio.ok) console.error('[forgot] no se pudo enviar el correo a', user.email, envio.error);

    return json(respuestaGenerica);
  } catch (err) {
    console.error('[forgot] error', err);
    return json(respuestaGenerica);
  }
};
