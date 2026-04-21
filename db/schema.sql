-- Spicy Matka — PostgreSQL schema
-- Run once on a fresh database: psql -d hsm-sanantonio -f db/schema.sql
-- For existing databases use db/migrate.sql instead

CREATE TABLE IF NOT EXISTS "Admin" (
  id       TEXT PRIMARY KEY,
  email    TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Category" (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  "imageUrl"      TEXT,
  "subCategories" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Item" (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  price             DOUBLE PRECISION NOT NULL,
  "categoryId"      TEXT NOT NULL REFERENCES "Category"(id),
  "subCategory"     TEXT,
  "isHsmSignature"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Media" (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  url        TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Ticker" (
  id          TEXT PRIMARY KEY,
  text        TEXT NOT NULL,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Special" (
  id          TEXT PRIMARY KEY,
  "imageUrl"  TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
