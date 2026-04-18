-- Spicy Matka — migration for existing databases
-- Run this if your tables already exist: psql -d hsm-sanantonio -f db/migrate.sql

ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "subCategories" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "Item"
  ADD COLUMN IF NOT EXISTS "subCategory" TEXT,
  ALTER COLUMN description SET DEFAULT '';

CREATE TABLE IF NOT EXISTS "Ticker" (
  id          TEXT PRIMARY KEY,
  text        TEXT NOT NULL,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE "Special"
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS detail,
  DROP COLUMN IF EXISTS price,
  DROP COLUMN IF EXISTS "sortOrder",
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Media"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT false;

-- If the table didn't exist at all, we create it
CREATE TABLE IF NOT EXISTS "Special" (
  id          TEXT PRIMARY KEY,
  "imageUrl"  TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
