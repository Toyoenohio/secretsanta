import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { sql, type User } from './db';

export const SESSION_COOKIE_NAME = 'ss_session';

export const FESTIVE_AVATARS = [
  'SS',
  'NV',
  'ES',
  'PI',
  'CI',
  'DO',
  'LU',
  'VE',
  'RO',
  'AL',
  'CA',
  'MA',
];

export function formatAvatarLabel(avatar?: string | null, name?: string | null): string {
  const cleanName = (name || '').trim();
  const initials = cleanName
    ? cleanName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('')
    : 'SS';
  if (!avatar) return initials || 'SS';
  if (/^[A-Za-z0-9]{1,3}$/.test(avatar.trim())) {
    return avatar.trim().toUpperCase();
  }
  return initials || 'SS';
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  if (derived.length !== keyBuffer.length) return false;
  return crypto.timingSafeEqual(derived, keyBuffer);
}

export async function createSession(userId: string, cookies: AstroCookies): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()})
  `;

  cookies.set(SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    expires: expiresAt,
  });

  return token;
}

export async function clearSession(cookies: AstroCookies): Promise<void> {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await sql`DELETE FROM sessions WHERE token = ${token}`;
  }
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

export async function getCurrentUser(cookies: AstroCookies): Promise<User | null> {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const rows = await sql`
      SELECT
        u.id,
        u.name,
        u.nickname,
        u.email,
        u.avatar,
        u.phone,
        u.shipping_address,
        u.likes,
        u.dislikes,
        u.shirt_size,
        u.pants_size,
        u.shoe_size,
        u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ${token}
        AND s.expires_at > NOW()
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return null;
    }

    return rows[0] as User;
  } catch (err) {
    console.error('Error fetching current user:', err);
    return null;
  }
}

export function generateInviteCode(prefix = 'SANTA'): string {
  const cleanPrefix = prefix
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'SANTA';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[crypto.randomInt(0, chars.length)];
  }
  return `${cleanPrefix}-${suffix}`;
}
