-- Schema is idempotent: safe to run again on any database.
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_date date,
  price_cap integer NOT NULL CHECK (price_cap > 0),
  invite_code text NOT NULL UNIQUE,
  organizer_id uuid,
  draw_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A roster row exists from the moment the organizer lists the name; it is "claimed" once the person
-- chooses a PIN and the credential columns are filled in (auth_hash IS NOT NULL).
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  salt text,
  auth_hash text,
  public_key text,
  wrapped_private_key text,
  wrap_iv text,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  pin_reset_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Upgrade from the email-based schema (no-ops on a fresh database).
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_reset_until timestamptz;
ALTER TABLE users ALTER COLUMN salt DROP NOT NULL;
ALTER TABLE users ALTER COLUMN auth_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN public_key DROP NOT NULL;
ALTER TABLE users ALTER COLUMN wrapped_private_key DROP NOT NULL;
ALTER TABLE users ALTER COLUMN wrap_iv DROP NOT NULL;
ALTER TABLE groups DROP COLUMN IF EXISTS expected_size;

CREATE INDEX IF NOT EXISTS users_group_idx ON users(group_id);

CREATE UNIQUE INDEX IF NOT EXISTS users_group_name_idx ON users (group_id, lower(name));

-- The app serves exactly one family group.
CREATE UNIQUE INDEX IF NOT EXISTS groups_single_idx ON groups ((true));

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
