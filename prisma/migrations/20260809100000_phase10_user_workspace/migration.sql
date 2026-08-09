-- Phase 10: user accounts and personal workspace

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text,
  avatar_url text,
  status text NOT NULL DEFAULT 'ACTIVE',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED'))
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system',
  interface_language text NOT NULL DEFAULT 'en',
  default_graph_depth int NOT NULL DEFAULT 3,
  graph_layout text NOT NULL DEFAULT 'hierarchical',
  show_meanings boolean NOT NULL DEFAULT true,
  show_sources boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_preferences_depth CHECK (default_graph_depth >= 1 AND default_graph_depth <= 10)
);

CREATE TABLE IF NOT EXISTS saved_words (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_saved_words_user_word UNIQUE (user_id, word_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_collections_user_name UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS collection_saved_words (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  saved_word_id uuid NOT NULL REFERENCES saved_words(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, saved_word_id)
);

CREATE TABLE IF NOT EXISTS saved_graphs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  root_entity_id uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  title text NOT NULL,
  depth int NOT NULL DEFAULT 3,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  layout_preference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_saved_graphs_depth CHECK (depth >= 1 AND depth <= 10)
);

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_notes_target_type CHECK (target_type IN ('WORD', 'LANGUAGE', 'RELATIONSHIP', 'GRAPH', 'COLLECTION'))
);

CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query text NOT NULL,
  searched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recent_views (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_saved_words_user_id ON saved_words(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_words_user_id_created_at ON saved_words(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id_updated_at ON notes(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_user_id_created_at ON search_history(user_id, searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_views_user_id_viewed_at ON recent_views(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_graphs_user_id_updated_at ON saved_graphs(user_id, updated_at DESC);
