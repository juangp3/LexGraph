-- Add missing provider_links table required by OAuth sign-in flow.

CREATE TABLE IF NOT EXISTS "provider_links" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "provider" TEXT NOT NULL,
  "provider_user_id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_provider_links_provider_providerUserId"
  ON "provider_links" ("provider", "provider_user_id");

CREATE INDEX IF NOT EXISTS "provider_links_user_id_idx"
  ON "provider_links" ("user_id");
