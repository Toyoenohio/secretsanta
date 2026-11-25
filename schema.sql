-- Esquema de Secret Santa (amigo secreto)
-- Generado a partir de las consultas del código: no existía ninguna migración.
-- Idempotente: se puede correr varias veces.

CREATE TABLE IF NOT EXISTS users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  nickname         text,
  email            text UNIQUE NOT NULL,
  password_hash    text NOT NULL,
  avatar           text,
  phone            text,
  shipping_address text,
  likes            text,
  dislikes         text,
  shirt_size       text,
  pants_size       text,
  shoe_size        text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,
  name          text NOT NULL,
  description   text,
  exchange_date date,
  budget_min    numeric(10,2),
  budget_max    numeric(10,2),
  currency      text DEFAULT 'USD',
  organizer_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'open',
  drawn_at      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_members (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id               uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_receiver_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  card_number           text,
  has_revealed          boolean NOT NULL DEFAULT false,
  revealed_at           timestamptz,
  joined_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS room_members_room_idx ON room_members(room_id);

CREATE TABLE IF NOT EXISTS room_exclusions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id                uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  giver_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  excluded_receiver_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason                 text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, giver_id, excluded_receiver_id)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                text NOT NULL,
  notes                text,
  url                  text,
  priority             text DEFAULT 'media',
  estimated_price      numeric(10,2),
  reserved_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  reserved_in_room_id  uuid REFERENCES rooms(id) ON DELETE SET NULL,
  reserved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wishlist_user_idx ON wishlist_items(user_id);

CREATE TABLE IF NOT EXISTS anonymous_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role text NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS anon_messages_room_idx ON anonymous_messages(room_id, created_at);

-- Recuperación de contraseña (Resend)
CREATE TABLE IF NOT EXISTS password_resets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  requested_ip text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS password_resets_expira_idx ON password_resets(expires_at);
