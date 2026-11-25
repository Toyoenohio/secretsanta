import webpush from 'web-push';
import { sql } from './db';

let configurado = false;

function configurar() {
  if (configurado) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sujeto = process.env.VAPID_SUBJECT || 'mailto:contacto@wtoyo.xyz';
  if (!pub || !priv) {
    console.warn('Push deshabilitado: faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY');
    return false;
  }
  webpush.setVapidDetails(sujeto, pub, priv);
  configurado = true;
  return true;
}

export function clavePublica(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export type CargaPush = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/** Envía la notificación a todas las suscripciones del usuario. Las caducadas se borran. */
export async function enviarPush(userId: string, carga: CargaPush): Promise<number> {
  if (!configurar()) return 0;

  const subs = (await sql`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}
  `) as Array<{ endpoint: string; p256dh: string; auth: string }>;

  if (subs.length === 0) return 0;

  const cuerpo = JSON.stringify(carga);
  let enviadas = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          cuerpo,
          { TTL: 60 * 60 * 24 }
        );
        enviadas++;
      } catch (err: any) {
        const codigo = err?.statusCode;
        if (codigo === 404 || codigo === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
        } else {
          console.error('Push falló:', codigo, err?.body || err?.message);
        }
      }
    })
  );

  return enviadas;
}
