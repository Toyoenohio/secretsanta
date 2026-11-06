import type { APIRoute } from 'astro';
import { clearSession } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  await clearSession(cookies);
  return redirect('/login');
};
