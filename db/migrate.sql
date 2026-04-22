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

-- HSM Signature attribute (additive, zero downtime)
ALTER TABLE "Item"
  ADD COLUMN IF NOT EXISTS "isHsmSignature" BOOLEAN NOT NULL DEFAULT false;

-- Category sort order (additive, zero downtime — DEFAULT 0 requires no table rewrite)
ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Back-fill existing categories with sequential order based on their creation date.
-- This UPDATE runs as a single atomic statement so there is no partial state.
UPDATE "Category" c
SET "sortOrder" = sub.rn
FROM (
  SELECT id,
         (ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) - 1)::integer AS rn
  FROM "Category"
) sub
WHERE c.id = sub.id;
