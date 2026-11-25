import type { APIRoute } from 'astro';
import { clavePublica } from '../../../lib/push';

export const GET: APIRoute = async () => {
  const publicKey = clavePublica();
  if (!publicKey) {
    return new Response(JSON.stringify({ error: 'Push no configurado' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ publicKey }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
