import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env before the pool is created (static imports run before module body)
dotenv.config({ path: join(__dirname, '.env') });

const { Pool } = pg;

const isLocal = process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1');

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('ssl');
    url.searchParams.delete('sslmode');
    connectionString = url.toString();
  } catch (e) {
    // Ignore invalid URL parsing errors
  }
}

export const pool = new Pool({
  connectionString,
  ...(!isLocal && {
    ssl: {
      rejectUnauthorized: false,
    },
  }),
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export const query = <T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
) => pool.query<T>(text, params);
