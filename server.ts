import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

const UPLOADS_DIR = join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.'));
    cb(null, Date.now() + ext);
  },
});

const upload = multer({ storage });

const parseSubCategories = (value: unknown): string[] => {
  if (!value) return [];

  let parsed = value;

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((subCategory): subCategory is string => typeof subCategory === 'string')
    .map((subCategory) => subCategory.trim())
    .filter(Boolean);
};

const ensureCategorySubCategoriesColumn = async () => {
  await query(`
    ALTER TABLE "Category"
    ADD COLUMN IF NOT EXISTS "subCategories" JSONB NOT NULL DEFAULT '[]'::jsonb
  `);
};

// ── Core Middlewares ─────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Auth Middleware ──────────────────────────────
const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ── AUTH ROUTES ──────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query(
    'SELECT * FROM "Admin" WHERE email = $1',
    [email]
  );

  const admin = rows[0];

  if (admin && (await bcrypt.compare(password, admin.password))) {
    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({ token });
  }

  res.status(401).json({ message: 'Invalid credentials' });
});

// ── CATEGORIES ───────────────────────────────────
app.get('/api/categories', async (_req, res) => {
  const { rows } = await query(`
    SELECT
      c.id, c.name, c."imageUrl", c."subCategories", c."createdAt",
      json_build_object('items', COUNT(i.id)::int) AS "_count"
    FROM "Category" c
    LEFT JOIN "Item" i ON i."categoryId" = c.id
    GROUP BY c.id, c.name, c."imageUrl", c."subCategories", c."createdAt"
    ORDER BY c."createdAt" ASC
  `);

  res.json(rows);
});

app.post('/api/categories', authenticateToken, upload.single('image'), async (req, res) => {
  const { name } = req.body;
  const subCategories = parseSubCategories(req.body.subCategories);

  const imageUrl = req.file
    ? `/uploads/${req.file.filename}`
    : req.body.imageUrl || null;

  try {
    const { rows } = await query(
      `INSERT INTO "Category" (id, name, "imageUrl", "subCategories", "createdAt")
       VALUES ($1, $2, $3, $4::jsonb, NOW()) RETURNING *`,
      [randomUUID(), name, imageUrl, JSON.stringify(subCategories)]
    );

    res.json(rows[0]);
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Category already exists' });
    }
    throw err;
  }
});

app.put('/api/categories/:id', authenticateToken, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const subCategories = parseSubCategories(req.body.subCategories);

  const newImage = req.file
    ? `/uploads/${req.file.filename}`
    : (req.body.imageUrl || null);

  const { rows } =
    newImage !== null
      ? await query(
          `UPDATE "Category" SET name = $1, "imageUrl" = $2, "subCategories" = $3::jsonb WHERE id = $4 RETURNING *`,
          [name, newImage, JSON.stringify(subCategories), id]
        )
      : await query(
          `UPDATE "Category" SET name = $1, "subCategories" = $2::jsonb WHERE id = $3 RETURNING *`,
          [name, JSON.stringify(subCategories), id]
        );

  if (!rows[0]) return res.status(404).json({ message: 'Category not found' });

  res.json(rows[0]);
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM "Item" WHERE "categoryId" = $1`,
    [id]
  );

  if (rows[0].count > 0) {
    return res.status(400).json({ message: 'Cannot delete category with items' });
  }

  await query(`DELETE FROM "Category" WHERE id = $1`, [id]);

  res.sendStatus(204);
});

// ── ITEMS ────────────────────────────────────────
app.get('/api/items', async (req, res) => {
  const categoryId = req.query.categoryId as string | undefined;

  const { rows } = await query(
    `SELECT
      i.id, i.name, i.description, i.price, i."categoryId", i."createdAt",
      json_build_object('id', c.id, 'name', c.name, 'imageUrl', c."imageUrl") AS category
     FROM "Item" i
     JOIN "Category" c ON c.id = i."categoryId"
     WHERE ($1::text IS NULL OR i."categoryId" = $1)
     ORDER BY i."createdAt" ASC`,
    [categoryId ?? null]
  );

  res.json(rows);
});

app.post('/api/items', authenticateToken, async (req, res) => {
  const { name, description, price, categoryId, subCategory } = req.body;

  const { rows } = await query(
    `INSERT INTO "Item" (id, name, description, price, "categoryId", "subCategory", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
    [randomUUID(), name, description, parseFloat(price), categoryId, subCategory || null]
  );

  res.json(rows[0]);
});

app.put('/api/items/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, categoryId, subCategory } = req.body;

  const { rows } = await query(
    `UPDATE "Item"
     SET name = $1, description = $2, price = $3, "categoryId" = $4, "subCategory" = $5
     WHERE id = $6 RETURNING *`,
    [name, description, parseFloat(price), categoryId, subCategory || null, id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: 'Item not found' });
  }

  res.json(rows[0]);
});

app.delete('/api/items/:id', authenticateToken, async (req, res) => {
  await query(`DELETE FROM "Item" WHERE id = $1`, [req.params.id]);
  res.sendStatus(204);
});

// ── MEDIA ────────────────────────────────────────
app.get('/api/media', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM "Media" ORDER BY id`);
  res.json(rows);
});

app.post('/api/media', authenticateToken, upload.single('file'), async (req, res) => {
  const { type } = req.body;
  const url = req.file
    ? `/uploads/${req.file.filename}`
    : req.body.url;

  const { rows } = await query(
    `INSERT INTO "Media" (id, type, url) VALUES ($1, $2, $3) RETURNING *`,
    [randomUUID(), type, url]
  );

  res.json(rows[0]);
});

app.put('/api/media/:id', authenticateToken, upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const { type } = req.body;

  const newUrl = req.file
    ? `/uploads/${req.file.filename}`
    : req.body.url ?? null;

  const { rows } =
    newUrl !== null
      ? await query(
          `UPDATE "Media" SET type = $1, url = $2 WHERE id = $3 RETURNING *`,
          [type, newUrl, id]
        )
      : await query(
          `UPDATE "Media" SET type = $1 WHERE id = $2 RETURNING *`,
          [type, id]
        );

  if (!rows[0]) return res.status(404).json({ message: 'Media not found' });

  res.json(rows[0]);
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
  await query(`DELETE FROM "Media" WHERE id = $1`, [req.params.id]);
  res.sendStatus(204);
});

// ── STATS ────────────────────────────────────────
app.get('/api/stats', authenticateToken, async (_req, res) => {
  const [catRes, itemRes, recentRes] = await Promise.all([
    query(`SELECT COUNT(*)::int AS count FROM "Category"`),
    query(`SELECT COUNT(*)::int AS count FROM "Item"`),
    query(`
      SELECT
        i.id, i.name, i.description, i.price, i."categoryId", i."createdAt",
        json_build_object('id', c.id, 'name', c.name) AS category
      FROM "Item" i
      JOIN "Category" c ON c.id = i."categoryId"
      ORDER BY i."createdAt" DESC
      LIMIT 5
    `),
  ]);

  res.json({
    categoryCount: catRes.rows[0].count,
    itemCount: itemRes.rows[0].count,
    recentItems: recentRes.rows,
  });
});

// ── ERROR HANDLER ────────────────────────────────
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

// ── START SERVER ─────────────────────────────────
ensureCategorySubCategoriesColumn()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to prepare database schema:', err);
    process.exit(1);
  });
