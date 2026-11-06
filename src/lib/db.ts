import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';

let cachedSql: NeonQueryFunction<false, false> | null = null;

function resolveDatabaseUrl(): string {
  let url =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.DATABASE_URL) ||
    process.env.DATABASE_URL;

  if (!url) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split(/\r?\n/)) {
          const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/);
          if (match && match[1]) {
            url = match[1].trim();
            process.env.DATABASE_URL = url;
            break;
          }
        }
      }
    } catch {}
  }

  if (!url) {
    throw new Error('DATABASE_URL no está configurada en las variables de entorno (.env)');
  }
  return url;
}

export const sql: NeonQueryFunction<false, false> = ((
  strings: TemplateStringsArray,
  ...params: any[]
) => {
  if (!cachedSql) {
    cachedSql = neon(resolveDatabaseUrl());
  }
  return cachedSql(strings, ...params);
}) as NeonQueryFunction<false, false>;

export interface User {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  avatar: string;
  phone: string | null;
  shipping_address: string | null;
  likes: string | null;
  dislikes: string | null;
  shirt_size: string | null;
  pants_size: string | null;
  shoe_size: string | null;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  url: string | null;
  priority: 'high' | 'medium' | 'low';
  estimated_price: string | null;
  reserved_by_user_id: string | null;
  reserved_in_room_id: string | null;
  reserved_at: string | null;
  created_at: string;
  reserved_room_name?: string | null;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  description: string | null;
  exchange_date: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  organizer_id: string;
  status: 'open' | 'drawn';
  drawn_at: string | null;
  created_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  assigned_receiver_id: string | null;
  card_number: number | null;
  has_revealed: boolean;
  revealed_at: string | null;
  joined_at: string;
  name: string;
  nickname: string | null;
  email: string;
  avatar: string;
}

export interface RoomExclusion {
  id: string;
  room_id: string;
  giver_id: string;
  excluded_receiver_id: string;
  reason: string | null;
  giver_name?: string;
  excluded_receiver_name?: string;
}

export interface AnonymousMessage {
  id: string;
  room_id: string;
  sender_id: string;
  receiver_id: string;
  sender_role: 'santa' | 'giftee';
  content: string;
  created_at: string;
}
