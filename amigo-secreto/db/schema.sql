CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_date date,
  price_cap integer NOT NULL CHECK (price_cap > 0),
  expected_size integer NOT NULL CHECK (expected_size >= 2),
  invite_code text NOT NULL UNIQUE,
  organizer_id uuid,
  draw_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  salt text NOT NULL,
  auth_hash text NOT NULL,
  public_key text NOT NULL,
  wrapped_private_key text NOT NULL,
  wrap_iv text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  pin_reset_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_reset_until timestamptz;

CREATE INDEX IF NOT EXISTS users_group_idx ON users(group_id);

CREATE TABLE IF NOT EXISTS wishes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 3),
  title text NOT NULL,
  price integer NOT NULL CHECK (price > 0),
  link text,
  PRIMARY KEY (user_id, position)
);

CREATE TABLE IF NOT EXISTS results (
  giver_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sealed text NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
