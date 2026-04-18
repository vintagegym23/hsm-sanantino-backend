import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const FRONTEND_DIR = join(ROOT_DIR, 'frontend');

dotenv.config({ path: join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';
import { query } from './db.js';
import { v2 as cloudinary } from 'cloudinary';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const UPLOADS_DIR = join(__dirname, 'uploads');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadToCloudinary = (buffer: Buffer, resourceType: 'image' | 'video' = 'image'): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: 'spicy-matka' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result!.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
};

const extractPublicId = (url: string) => {
  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex === -1) return null;
  const pathPart = url.substring(uploadIndex + 8); 
  const parts = pathPart.split('/');
  if (parts[0].startsWith('v') && !isNaN(parseInt(parts[0].substring(1)))) {
    parts.shift();
  }
  const fullPath = parts.join('/');
  const lastDot = fullPath.lastIndexOf('.');
  return lastDot !== -1 ? fullPath.substring(0, lastDot) : fullPath;
};

const deleteFile = async (url: string | null | undefined, resourceType: 'image' | 'video' = 'image') => {
  if (!url) return;
  if (url.startsWith('/uploads/')) {
    const filePath = join(__dirname, url);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (err) { console.error('Local delete error:', err); }
    }
  } else if (url.includes('cloudinary.com')) {
    const publicId = extractPublicId(url);
    if (publicId) {
      try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }); } 
      catch (err) { console.error('Cloudinary delete error:', err); }
    }
  }
};
async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(UPLOADS_DIR));

  // ── Auth Middleware ─────────────────────────────────────────────────────────
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // ── Auth ────────────────────────────────────────────────────────────────────
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await query('SELECT * FROM "Admin" WHERE email = $1', [email]);
    const admin = rows[0];
    if (admin && (await bcrypt.compare(password, admin.password))) {
      const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  });

  // ── Categories ──────────────────────────────────────────────────────────────
  app.get('/api/categories', async (req, res) => {
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
    try {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: 'Category name is required' });
      let imageUrl = req.body.imageUrl || null;
      if (req.file) {
        imageUrl = await uploadToCloudinary(req.file.buffer, 'image');
      }
      let subCategories: string[] = [];
      try {
        if (req.body.subCategories) {
          subCategories = JSON.parse(req.body.subCategories);
        }
        if (!Array.isArray(subCategories)) {
          return res.status(400).json({ message: 'subCategories must be an array' });
        }
      } catch (err) {
        return res.status(400).json({ message: 'Invalid JSON for subCategories' });
      }

      const { rows } = await query(
        `INSERT INTO "Category" (id, name, "imageUrl", "subCategories", "createdAt")
         VALUES ($1, $2, $3, $4::jsonb, NOW()) RETURNING *`,
        [randomUUID(), name.trim(), imageUrl, JSON.stringify(subCategories)],
      );
      res.json(rows[0]);
    } catch (err: any) {
      if (err.code === '23505') return res.status(409).json({ message: `Category "${req.body?.name}" already exists` });
      if (err.code === '42703') return res.status(500).json({ message: 'Database schema is outdated — run: npm run db:migrate' });
      console.error('Category POST error:', err.code, err.message);
      res.status(500).json({ message: err.message || 'Error creating category' });
    }
  });

  app.put('/api/categories/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    // Build SET clause dynamically so callers can update a subset of fields
    // without accidentally resetting fields they didn't touch (e.g. subCategories).
    const sets: string[] = [];
    const params: unknown[] = [];

    const push = (val: unknown) => { params.push(val); return `$${params.length}`; };

    if (req.body.name !== undefined) sets.push(`name=${push(req.body.name)}`);

    if (req.file) {
      const newImageUrl = await uploadToCloudinary(req.file.buffer, 'image');
      sets.push(`"imageUrl"=${push(newImageUrl)}`);
      const { rows: existing } = await query(`SELECT "imageUrl" FROM "Category" WHERE id = $1`, [id]);
      if (existing[0]?.imageUrl) await deleteFile(existing[0].imageUrl);
    } else if (req.body.imageUrl !== undefined) {
      sets.push(`"imageUrl"=${push(req.body.imageUrl || null)}`);
    }

    if (req.body.subCategories !== undefined) {
      try {
        const parsed = JSON.parse(req.body.subCategories);
        if (!Array.isArray(parsed)) {
          return res.status(400).json({ message: 'subCategories must be an array' });
        }
        sets.push(`"subCategories"=${push(JSON.stringify(parsed))}::jsonb`);
      } catch (err) {
        return res.status(400).json({ message: 'Invalid JSON for subCategories' });
      }
    }

    if (sets.length === 0) return res.status(400).json({ message: 'Nothing to update' });

    params.push(id);
    const { rows } = await query(
      `UPDATE "Category" SET ${sets.join(', ')} WHERE id=$${params.length} RETURNING *`,
      params,
    );

    if (!rows[0]) return res.status(404).json({ message: 'Category not found' });
    res.json(rows[0]);
  });

  app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count FROM "Item" WHERE "categoryId" = $1`,
      [id],
    );
    if (rows[0].count > 0) {
      return res.status(400).json({ message: 'Cannot delete category with items' });
    }
    const { rows: deletedRows } = await query(`DELETE FROM "Category" WHERE id = $1 RETURNING "imageUrl"`, [id]);
    if (deletedRows[0]?.imageUrl) await deleteFile(deletedRows[0].imageUrl);
    res.sendStatus(204);
  });

  // ── Items ───────────────────────────────────────────────────────────────────
  app.get('/api/items', async (req, res) => {
    const categoryId = req.query.categoryId as string | undefined;
    const subCategory = req.query.subCategory as string | undefined;

    let sql = `
      SELECT
        i.id, i.name, i.description, i.price, i."categoryId", i."subCategory", i."createdAt",
        json_build_object('id', c.id, 'name', c.name, 'imageUrl', c."imageUrl") AS category
       FROM "Item" i
       JOIN "Category" c ON c.id = i."categoryId"
       WHERE ($1::text IS NULL OR i."categoryId" = $1)
    `;
    const params: (string | null)[] = [categoryId ?? null];

    if (subCategory) {
      params.push(subCategory);
      sql += ` AND i."subCategory" = $${params.length}`;
    }

    sql += ` ORDER BY i."createdAt" ASC`;

    const { rows } = await query(sql, params);
    res.json(rows);
  });

  app.post('/api/items', authenticateToken, async (req, res) => {
    const { name, description, price, categoryId, subCategory } = req.body;
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice)) return res.status(400).json({ message: 'Invalid price' });
    
    const { rows } = await query(
      `INSERT INTO "Item" (id, name, description, price, "categoryId", "subCategory", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [randomUUID(), name, description ?? '', parsedPrice, categoryId, subCategory ?? null],
    );
    res.json(rows[0]);
  });

  app.put('/api/items/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, description, price, categoryId, subCategory } = req.body;
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice)) return res.status(400).json({ message: 'Invalid price' });

    const { rows } = await query(
      `UPDATE "Item"
       SET name=$1, description=$2, price=$3, "categoryId"=$4, "subCategory"=$5
       WHERE id=$6 RETURNING *`,
      [name, description ?? '', parsedPrice, categoryId, subCategory ?? null, id],
    );
    if (!rows[0]) return res.status(404).json({ message: 'Item not found' });
    res.json(rows[0]);
  });

  app.delete('/api/items/:id', authenticateToken, async (req, res) => {
    await query(`DELETE FROM "Item" WHERE id = $1`, [req.params.id]);
    res.sendStatus(204);
  });

  // ── Media ───────────────────────────────────────────────────────────────────
  app.get('/api/media', async (req, res) => {
    const { rows } = await query(`SELECT * FROM "Media" ORDER BY id`);
    res.json(rows);
  });

  app.post('/api/media', authenticateToken, upload.single('file'), async (req, res) => {
    try {
      const { type } = req.body;
      let url = req.body.url;
      const isHero = ['hero_image', 'hero_video'].includes(type);
      
      if (req.file) {
        const resourceType = type === 'hero_video' ? 'video' : 'image';
        url = await uploadToCloudinary(req.file.buffer, resourceType);
      }

      if (isHero) {
        await query(`UPDATE "Media" SET "isActive" = false WHERE type IN ('hero_image', 'hero_video')`);
      }

      const { rows } = await query(
        `INSERT INTO "Media" (id, type, url, "isActive") VALUES ($1, $2, $3, $4) RETURNING *`,
        [randomUUID(), type, url, isHero],
      );
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error uploading media' });
    }
  });

  app.put('/api/media/:id', authenticateToken, upload.single('file'), async (req, res) => {
    try {
      const { id } = req.params;
      const { type } = req.body;
      let newUrl = req.body.url ?? null;

      const isHero = ['hero_image', 'hero_video'].includes(type);
      if (isHero) {
        await query(`UPDATE "Media" SET "isActive" = false WHERE type IN ('hero_image', 'hero_video')`);
      }

      if (req.file) {
        const resourceType = type === 'hero_video' ? 'video' : 'image';
        newUrl = await uploadToCloudinary(req.file.buffer, resourceType);
        
        const { rows: existing } = await query(`SELECT url, type FROM "Media" WHERE id = $1`, [id]);
        if (existing[0]?.url) {
          const oldIsVideo = existing[0].type === 'hero_video';
          await deleteFile(existing[0].url, oldIsVideo ? 'video' : 'image');
        }
      }

      const { rows } = newUrl !== null
        ? await query(
            `UPDATE "Media" SET type = $1, url = $2, "isActive" = $4 WHERE id = $3 RETURNING *`,
            [type, newUrl, id, isHero],
          )
        : await query(
            `UPDATE "Media" SET type = $1, "isActive" = $3 WHERE id = $2 RETURNING *`,
            [type, id, isHero],
          );

      if (!rows[0]) return res.status(404).json({ message: 'Media not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error updating media' });
    }
  });

  app.patch('/api/media/:id/activate', authenticateToken, async (req, res) => {
    const { id } = req.params;
    await query(`UPDATE "Media" SET "isActive" = false WHERE type IN ('hero_image', 'hero_video')`);
    const { rows } = await query(`UPDATE "Media" SET "isActive" = true WHERE id = $1 RETURNING *`, [id]);
    if (!rows[0]) return res.status(404).json({ message: 'Media not found' });
    res.json(rows[0]);
  });

  app.delete('/api/media/:id', authenticateToken, async (req, res) => {
    const { rows: deletedRows } = await query(`DELETE FROM "Media" WHERE id = $1 RETURNING *`, [req.params.id]);
    
    // Auto-activate remaining hero media if the deleted one was active
    if (deletedRows[0] && deletedRows[0].isActive && ['hero_image', 'hero_video'].includes(deletedRows[0].type)) {
       await query(`UPDATE "Media" SET "isActive" = true WHERE id = (SELECT id FROM "Media" WHERE type IN ('hero_image', 'hero_video') LIMIT 1)`);
    }

    if (deletedRows[0]?.url) {
      const isVideo = deletedRows[0].type === 'hero_video';
      await deleteFile(deletedRows[0].url, isVideo ? 'video' : 'image');
    }

    res.sendStatus(204);
  });

  // ── Ticker ──────────────────────────────────────────────────────────────────
  app.get('/api/ticker', async (_req, res) => {
    const { rows } = await query(
      `SELECT * FROM "Ticker" ORDER BY "sortOrder" ASC, "createdAt" ASC`,
    );
    res.json(rows);
  });

  app.post('/api/ticker', authenticateToken, async (req, res) => {
    const { text } = req.body;
    const { rows: countRows } = await query(`SELECT COUNT(*)::int AS count FROM "Ticker"`);
    const sortOrder = countRows[0].count;
    const { rows } = await query(
      `INSERT INTO "Ticker" (id, text, "sortOrder", "createdAt") VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [randomUUID(), text, sortOrder],
    );
    res.json(rows[0]);
  });

  app.put('/api/ticker/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    const { rows } = await query(
      `UPDATE "Ticker" SET text=$1 WHERE id=$2 RETURNING *`,
      [text, id],
    );
    if (!rows[0]) return res.status(404).json({ message: 'Ticker item not found' });
    res.json(rows[0]);
  });

  app.delete('/api/ticker/:id', authenticateToken, async (req, res) => {
    await query(`DELETE FROM "Ticker" WHERE id=$1`, [req.params.id]);
    res.sendStatus(204);
  });

  // ── Specials ─────────────────────────────────────────────────────────────────
  app.get('/api/specials', async (_req, res) => {
    const { rows } = await query(
      `SELECT * FROM "Special" ORDER BY "createdAt" ASC`,
    );
    res.json(rows);
  });

  app.post('/api/specials', authenticateToken, upload.single('image'), async (req, res) => {
    const { rows: countRows } = await query(`SELECT COUNT(*)::int AS count FROM "Special"`);
    if (countRows[0].count >= 3) {
      return res.status(400).json({ message: 'Maximum of 3 specials allowed. Delete one first.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    try {
      const imageUrl = await uploadToCloudinary(req.file.buffer, 'image');
      
      const { rows } = await query(
        `INSERT INTO "Special" (id, "imageUrl", "createdAt") VALUES ($1, $2, NOW()) RETURNING *`,
        [randomUUID(), imageUrl],
      );
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error uploading special' });
    }
  });

  app.delete('/api/specials/:id', authenticateToken, async (req, res) => {
    const { rows } = await query(`DELETE FROM "Special" WHERE id=$1 RETURNING "imageUrl"`, [req.params.id]);
    if (rows[0]?.imageUrl) await deleteFile(rows[0].imageUrl);
    res.sendStatus(204);
  });

  // ── Stats ───────────────────────────────────────────────────────────────────
  app.get('/api/stats', authenticateToken, async (req, res) => {
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

  // ── Global error handler ────────────────────────────────────────────────────
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  });

  // ── Health Check Route ──────────────────────────────────────────────────────
  app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'Spicy Matka API is running' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
