import { readEnv } from './env';

/**
 * Quién puede crear salas.
 *
 * La creación está reservada a la cuenta organizadora. Se define en
 * `ROOM_CREATORS` (lista separada por comas) y por defecto es la cuenta de Wilmer.
 * El resto de las personas sólo puede unirse con un código.
 */
const POR_DEFECTO = 'wtoyo.am@gmail.com';

export function correosCreadores(): string[] {
  return (readEnv('ROOM_CREATORS') || POR_DEFECTO)
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

export function puedeCrearSalas(user?: { email?: string | null } | null): boolean {
  const email = (user?.email || '').trim().toLowerCase();
  if (!email) return false;
  return correosCreadores().includes(email);
}
