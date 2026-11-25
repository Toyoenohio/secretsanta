import { readEnv } from './env';

/**
 * URL pública del sitio.
 *
 * Detrás del túnel, `Astro.url.origin` sale del Host que llega al proceso Node,
 * y en este server ese Host es `localhost:4321`. Por eso los enlaces que se
 * comparten (invitación a una sala) mostraban “localhost”.
 *
 * Orden: SITE_URL del .env → cabeceras del proxy (x-forwarded-host/proto) →
 * el origin de la request si no es loopback → dominio de producción.
 */
export function siteBaseUrl(request?: Request, requestOrigin?: string): string {
  const configurada = readEnv('SITE_URL');
  if (configurada) return configurada.replace(/\/+$/, '');

  if (request) {
    const proto = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim() || 'https';
    const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '')
      .split(',')[0]
      .trim();
    if (host && !/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i.test(host)) {
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  if (requestOrigin && !/\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i.test(requestOrigin)) {
    return requestOrigin.replace(/\/+$/, '');
  }

  return 'https://amigosecreto.ciwok.com';
}
