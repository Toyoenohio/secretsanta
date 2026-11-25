import { readEnv } from './env';

/**
 * Envío de correo transaccional vía Resend.
 * Sin SDK: la API es un POST JSON y así no sumamos dependencias.
 * Un fallo de correo NUNCA debe romper el flujo que lo dispara.
 */

const RESEND_URL = 'https://api.resend.com/emails';

export function mailConfig() {
  const apiKey = readEnv('RESEND_API_KEY');
  const from = readEnv('MAIL_FROM') || 'Amigo Secreto <ayudantedesanta@amigosecreto.ciwok.com>';
  const replyTo = readEnv('MAIL_REPLY_TO') || undefined;
  const siteUrl = (readEnv('SITE_URL') || 'https://amigosecreto.ciwok.com').replace(/\/$/, '');
  return { apiKey, from, replyTo, siteUrl };
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { apiKey, from, replyTo } = mailConfig();
  if (!apiKey) {
    console.error('[mail] falta RESEND_API_KEY');
    return { ok: false, error: 'not_configured' };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'amigosecreto/1.0',
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[mail] Resend respondió', res.status, body.slice(0, 300));
      return { ok: false, error: `resend_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error('[mail] error de red', err);
    return { ok: false, error: 'network' };
  }
}

/* ------------------------------- plantillas ------------------------------- */
/* Mismas piezas del sitio: banda de pino, rojo regalo, oro y tipografía display.
   Todo con tablas y estilos en línea: Outlook y Gmail no entienden flex ni grid. */

const C = {
  bg: '#f5faf7',
  papel: '#ffffff',
  borde: '#e3eae6',
  ink: '#171d1b',
  muted: '#574142',
  acento: '#a7303f',
  pino: '#2b6955',
  pinoSuave: '#b0f0d6',
  oro: '#f5bd62',
  panel: '#f0f5f2',
};

const FUENTE = "'Space Grotesk','Plus Jakarta Sans','Trebuchet MS',Helvetica,Arial,sans-serif";
const TEXTO = "'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif";

function guirnalda(): string {
  const bombillas = ['#a7303f', '#f5bd62', '#2b6955', '#4aa8f0', '#a7303f', '#f5bd62', '#2b6955'];
  const celdas = bombillas
    .map(
      (color) =>
        `<td align="center" valign="bottom" style="padding:0;height:18px;border-bottom:2px solid ${C.pino}">` +
        `<div style="width:8px;height:8px;background:${color};font-size:0;line-height:0">&nbsp;</div></td>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;padding:0 26px">
    <tr><td style="padding:0 26px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
        <tr>${celdas}</tr>
      </table>
    </td></tr>
  </table>`;
}

function layout(opts: {
  preheader: string;
  titulo: string;
  saludo?: string;
  entradilla: string;
  cuerpo: string;
  cta?: { texto: string; url: string };
  nota?: string;
  enlaceTexto?: { etiqueta: string; url: string };
}): string {
  const boton = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:26px 0 18px">
         <tr>
           <td align="center" bgcolor="${C.acento}" style="border-radius:10px">
             <a href="${opts.cta.url}" target="_blank"
                style="display:inline-block;padding:15px 26px;font-family:${FUENTE};font-size:13px;font-weight:700;
                       letter-spacing:.07em;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:10px">
               <span style="color:${C.oro}">&#10022;</span>&nbsp;&nbsp;${opts.cta.texto}
             </a>
           </td>
         </tr>
       </table>`
    : '';

  const nota = opts.nota
    ? `<p style="margin:18px 0 0;font-family:${TEXTO};font-size:12.5px;line-height:1.6;color:${C.muted}">${opts.nota}</p>`
    : '';

  const enlaceTexto = opts.enlaceTexto
    ? `<p style="margin:0 0 6px;font-family:${TEXTO};font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:${C.muted}">${opts.enlaceTexto.etiqueta}</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
         <tr><td style="background:${C.panel};border:1px solid ${C.borde};border-radius:8px;padding:12px 14px">
           <a href="${opts.enlaceTexto.url}" target="_blank"
              style="font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:12px;line-height:1.5;color:${C.pino};text-decoration:none;word-break:break-all">
             ${opts.enlaceTexto.url}
           </a>
         </td></tr>
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${opts.titulo}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${opts.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border-collapse:collapse;background:${C.bg};padding:0">
    <tr>
      <td align="center" style="padding:28px 12px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:600px;max-width:600px;border-collapse:collapse;background:${C.papel};
                      border:1px solid ${C.borde};border-radius:16px;overflow:hidden">

          <tr><td style="padding:18px 0 0">${guirnalda()}</td></tr>

          <tr>
            <td style="padding:18px 32px 0">
              <span style="font-family:${FUENTE};font-size:15px;font-weight:700;color:${C.ink};letter-spacing:.01em">
                <span style="color:${C.oro}">&#9733;</span>&nbsp; Secret Santa
              </span>
              <span style="font-family:${TEXTO};font-size:11.5px;color:${C.muted}">&nbsp;&middot;&nbsp; amigosecreto.ciwok.com</span>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 32px 0">
              <h1 style="margin:0;font-family:${FUENTE};font-size:27px;line-height:1.15;font-weight:800;
                         text-transform:uppercase;letter-spacing:.005em;color:${C.ink}">${opts.titulo}</h1>
              ${opts.saludo ? `<p style="margin:16px 0 0;font-family:${TEXTO};font-size:15px;line-height:1.6;color:${C.ink};font-weight:600">${opts.saludo}</p>` : ''}
              <p style="margin:${opts.saludo ? '8px' : '14px'} 0 0;font-family:${TEXTO};font-size:15px;line-height:1.65;color:${C.muted}">${opts.entradilla}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 30px">
              <div style="font-family:${TEXTO};font-size:14.5px;line-height:1.7;color:${C.ink}">${opts.cuerpo}</div>
              ${boton}
              ${enlaceTexto}
              ${nota}
            </td>
          </tr>

          <tr>
            <td style="padding:16px 32px 22px;border-top:1px solid ${C.panel}">
              <p style="margin:0;font-family:${TEXTO};font-size:11.5px;line-height:1.6;color:${C.muted}">
                2026 &middot; Acceso privado &nbsp;|&nbsp;
                <a href="https://amigosecreto.ciwok.com" target="_blank" style="color:${C.pino};text-decoration:none">
                  amigosecreto.ciwok.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function plantillaReset(nombre: string, enlace: string, minutos: number) {
  const saludo = nombre ? `Hola, ${nombre}:` : 'Hola:';
  const html = layout({
    preheader: `Enlace para elegir tu contraseña nueva. Vence en ${minutos} minutos.`,
    titulo: 'Cambiá tu contraseña.',
    saludo,
    entradilla: 'Pediste una contraseña nueva para tu cuenta de Amigo Secreto.',
    cuerpo: `<p style="margin:0">Tocá el botón y elegí la que quieras. El enlace sirve <strong>una sola vez</strong> y vence en ${minutos} minutos.</p>`,
    cta: { texto: 'Elegir contraseña', url: enlace },
    enlaceTexto: { etiqueta: 'Si el botón no abre, copiá este enlace', url: enlace },
    nota: 'Si no pediste el cambio, ignorá este correo: tu contraseña sigue igual y tu cuenta no se tocó.',
  });
  const text = `${saludo}\n\nPediste cambiar tu contraseña en Amigo Secreto.\nAbrí este enlace (vence en ${minutos} minutos y sirve una sola vez):\n${enlace}\n\nSi no pediste el cambio, ignorá este correo.`;
  return { html, text };
}

export function plantillaAvisoLogin(datos: {
  nombre: string;
  email: string;
  cuando: string;
  ip: string;
  dispositivo: string;
}) {
  const saludo = datos.nombre ? `Hola, ${datos.nombre}:` : 'Hola:';
  const fila = (etiqueta: string, valor: string) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${C.panel};font-family:${TEXTO};font-size:11px;
                 letter-spacing:.09em;text-transform:uppercase;color:${C.muted};width:132px;vertical-align:top">${etiqueta}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${C.panel};font-family:${TEXTO};font-size:14px;
                 color:${C.ink};vertical-align:top">${valor}</td>
    </tr>`;

  const html = layout({
    preheader: `Entraste a tu cuenta el ${datos.cuando}. Si no fuiste vos, cambiá la contraseña.`,
    titulo: 'Entraste a tu cuenta.',
    saludo,
    entradilla: 'Este es el registro del último ingreso a tu cuenta.',
    cuerpo: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
        ${fila('Cuándo', datos.cuando)}
        ${fila('Cuenta', datos.email)}
        ${fila('IP', datos.ip)}
        ${fila('Dispositivo', datos.dispositivo)}
      </table>`,
    cta: { texto: 'No fui yo', url: 'https://amigosecreto.ciwok.com/forgot' },
    nota: 'Si fuiste vos, no hay nada que hacer. Si no reconocés este ingreso, cambiá tu contraseña ahora: al guardarla se cierran todas las sesiones abiertas.',
  });
  const text = `${saludo}\n\nEntraste a tu cuenta de Amigo Secreto.\nCuándo: ${datos.cuando}\nCuenta: ${datos.email}\nIP: ${datos.ip}\nDispositivo: ${datos.dispositivo}\n\nSi no fuiste vos, cambiá tu contraseña: https://amigosecreto.ciwok.com/forgot`;
  return { html, text };
}

export function fechaVenezuela(): string {
  try {
    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Caracas',
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}
