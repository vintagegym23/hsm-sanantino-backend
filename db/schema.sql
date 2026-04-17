-- Spicy Matka — PostgreSQL schema
-- Run once to set up the database: psql -d hsm-sanantonio -f db/schema.sql

CREATE TABLE IF NOT EXISTS "Admin" (
  id       TEXT PRIMARY KEY,
  email    TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Category" (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  "imageUrl"  TEXT,
  "subCategories" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Item" (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  price        DOUBLE PRECISION NOT NULL,
  "categoryId" TEXT NOT NULL REFERENCES "Category"(id),
  "subCategory" TEXT,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Media" (
  id   TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  url  TEXT NOT NULL
);
