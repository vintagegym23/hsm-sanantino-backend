import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { query, pool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env variables
dotenv.config({ path: join(__dirname, '../.env') });

async function createAdmin() {
  const username = 'Websiteadmin@gmail.com';
  const password = 'Admin@123';
  
  console.log(`Creating admin user: ${username}...`);
  
  try {
    // Remove the old username that isn't an email
    await query(`DELETE FROM "Admin" WHERE email = $1`, ['Websiteadmin']);
    console.log(`Removed old 'Websiteadmin' record if it existed.`);
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert or update the admin user
    await query(
      `INSERT INTO "Admin" (id, email, password)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) 
       DO UPDATE SET password = EXCLUDED.password`,
      [randomUUID(), username, hashedPassword]
    );
    
    console.log(`✅ Admin user '${username}' has been successfully created/updated!`);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    // Close the database pool so the script exits cleanly
    await pool.end();
  }
}

createAdmin();
