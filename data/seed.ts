import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { query, pool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  // ================= ADMIN =================
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await query(
    `INSERT INTO "Admin" (id, email, password)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    [randomUUID(), 'admin@spicymatka.com', hashedPassword],
  );

  // ================= CATEGORIES =================
  const categories = [
    'Soups',
    'Momo',
    'Veg Tandoor',
    'Non-Veg Tandoor',
    'Veg Appetizers',
    'Non-Veg Appetizers',
    'Biryani',
    'Family Pack Biryani',
    'Indo Chinese',
    'Fried Rice',
    'Noodles',
    'Veg Curries',
    'Egg Curries',
    'Non-Veg Curries',
    'Kids Menu',
    'Drinks',
    'Dessert',
    'Breads & Rice',
    'Extras',
    'Mandi',
    'Dosas',
    'Beer',
    'Wine',
  ];

  const categoryIds: Record<string, string> = {};

  for (const name of categories) {
    const id = randomUUID();
    categoryIds[name] = id;

    await query(
      `INSERT INTO "Category" (id, name, "createdAt")
       VALUES ($1, $2, NOW())
       ON CONFLICT (name) DO NOTHING`,
      [id, name],
    );
  }

  // fetch actual ids
  const { rows: catRows } = await query(
    `SELECT id, name FROM "Category"`,
  );

  catRows.forEach((c: any) => {
    categoryIds[c.name] = c.id;
  });

  // ================= ITEMS =================
  const items = [

    // ===== SOUPS =====
    ['Sweet Corn (Veg)', 7, 'Soups'],
    ['Sweet Corn (Chicken)', 8, 'Soups'],
    ['Manchow (Veg)', 7, 'Soups'],
    ['Manchow (Chicken)', 8, 'Soups'],
    ['Lemon Coriander (Veg)', 7, 'Soups'],
    ['Lemon Coriander (Chicken)', 8, 'Soups'],
    ['Hot and Sour (Veg)', 7, 'Soups'],
    ['Hot and Sour (Chicken)', 8, 'Soups'],
    ['Nawabi Goat Paya', 11, 'Soups'],

    // ===== MOMO =====
    ['Masala Tossed Momo (Veg)', 11, 'Momo'],
    ['Masala Tossed Momo (Chicken)', 13, 'Momo'],
    ['Malai Tossed Momo (Veg)', 11, 'Momo'],
    ['Malai Tossed Momo (Chicken)', 13, 'Momo'],
    ['Fried Momo (Veg)', 11, 'Momo'],
    ['Fried Momo (Chicken)', 13, 'Momo'],
    ['Tikka Momo (Veg)', 11, 'Momo'],
    ['Tikka Momo (Chicken)', 13, 'Momo'],
    ['Chilli Tossed Momo (Veg)', 11, 'Momo'],
    ['Chilli Tossed Momo (Chicken)', 13, 'Momo'],
    ['Schezwan Tossed Momo (Veg)', 11, 'Momo'],
    ['Schezwan Tossed Momo (Chicken)', 13, 'Momo'],

    // ===== VEG TANDOOR =====
    ['Paneer Tikka Kabab', 15, 'Veg Tandoor'],
    ['Pudina Paneer Kabab', 15, 'Veg Tandoor'],
    ['Pandumirchi Paneer Kabab (Spicy)', 16, 'Veg Tandoor'],
    ['Malai Broccoli Kabab', 15, 'Veg Tandoor'],
    ['Kaju Paneer Kabab', 16, 'Veg Tandoor'],
    ['Assorted Veg Tandoori Plater', 18, 'Veg Tandoor'],

    // ===== NON VEG TANDOOR =====
    ['Chicken Tandoori (Bone-in)', 16, 'Non-Veg Tandoor'],
    ['Chicken Tandoori (Boneless)', 17, 'Non-Veg Tandoor'],
    ['Malai Tandoor Chicken (Boneless)', 17, 'Non-Veg Tandoor'],
    ['Chicken Tangdi Kabab', 17, 'Non-Veg Tandoor'],
    ['Gongura Tandoor Chicken (Spicy)', 18, 'Non-Veg Tandoor'],
    ['Pandumirchi Chicken Kabab', 18, 'Non-Veg Tandoor'],
    ['Assorted Tandoor Chicken Platter', 20, 'Non-Veg Tandoor'],
    ['Tandoori Jhinga Prawn', 20, 'Non-Veg Tandoor'],
    ['Pomfret', 24, 'Non-Veg Tandoor'],
    ['Sizzling Lamb Chops', 24, 'Non-Veg Tandoor'],

    // ===== VEG APPETIZERS =====
    ['Samosa (2)', 6, 'Veg Appetizers'],
    ['Bullet Samosa (6)', 10, 'Veg Appetizers'],
    ['Masala Tossed Fries', 10, 'Veg Appetizers'],
    ['Crispy Corn', 13, 'Veg Appetizers'],
    ['Masala Papad (2)', 6, 'Veg Appetizers'],
    ['Ghee Roast (Paneer)', 15, 'Veg Appetizers'],
    ['Masala 65 (Veg)', 14, 'Veg Appetizers'],
    ['Crispy Cauliflower', 14, 'Veg Appetizers'],
    ['Nalakaram (Spicy)', 14, 'Veg Appetizers'],
    ['Street Style Mirchi Bajji (4)', 12, 'Veg Appetizers'],
    ['Karivepaku', 14, 'Veg Appetizers'],
    ['Allam (Spicy)', 14, 'Veg Appetizers'],
    ['Amaravathi (Spicy)', 14, 'Veg Appetizers'],
    ['Village Style', 14, 'Veg Appetizers'],
    ['Majestic', 14, 'Veg Appetizers'],
    ['Soya Masala Chops', 14, 'Veg Appetizers'],
    ['Hyderabadi Masala Chestnuts', 14, 'Veg Appetizers'],
    ['Matka Spl Lotus Root Pepper Roast', 15, 'Veg Appetizers'],

    // ===== NON VEG APPETIZERS =====
    ['Chicken 65', 15, 'Non-Veg Appetizers'],
    ['Chicken Lollipop (5)', 15, 'Non-Veg Appetizers'],
    ['Sukka (Chicken)', 15, 'Non-Veg Appetizers'],
    ['Ghee Roast (Chicken)', 15, 'Non-Veg Appetizers'],
    ['Apollo Fish', 18, 'Non-Veg Appetizers'],
    ['Natukodi Vepudu', 22, 'Non-Veg Appetizers'],
    ['Karimnagar Chicken Wings', 16, 'Non-Veg Appetizers'],
    ['Nallakaram (Spicy)', 15, 'Non-Veg Appetizers'],
    ['Tawa Fish', 20, 'Non-Veg Appetizers'],

    // ===== BIRYANI =====
    ['Dum Biryani (Chicken)', 15, 'Biryani'],
    ['Dum Biryani (Goat)', 17, 'Biryani'],
    ['Chicken Boneless Biryani', 17, 'Biryani'],
    ['65 Biryani', 17, 'Biryani'],
    ['Kheema Biryani', 20, 'Biryani'],
    ['Potlam Biryani', 18, 'Biryani'],
    ['Cashew Biryani', 17, 'Biryani'],
    ['Matka Special Biryani', 17, 'Biryani'],
    ['Matka Fry Biryani', 17, 'Biryani'],
    ['Gongura Biryani', 17, 'Biryani'],
    ['Ulavacharu Biryani', 17, 'Biryani'],
    ['Nalli Gosht Biryani', 25, 'Biryani'],
    ['Natukodi Fry Biryani', 22, 'Biryani'],

    // ===== DRINKS =====
    ['Bottle Water', 0.5, 'Drinks'],
    ['Chai', 2.5, 'Drinks'],
    ['Coffee', 3.5, 'Drinks'],
    ['Mango Lassi', 7, 'Drinks'],
    ['Badam Milk', 7, 'Drinks'],
    ['Sapota Shake', 8, 'Drinks'],
    ['Custard Apple Shake', 9, 'Drinks'],
    ['Fresh Limesoda', 6, 'Drinks'],

    // ===== DESSERT =====
    ['Gulab Jamun', 5, 'Dessert'],
    ['Rabdi Gulab Jamun', 6, 'Dessert'],
    ['Apricot Delight', 8, 'Dessert'],
    ['Tender Coconut Souffle', 8, 'Dessert'],
    ['Chikku Delight', 8, 'Dessert'],

    // ===== BREADS =====
    ['Tandoori Roti', 4, 'Breads & Rice'],
    ['Plain Naan', 3, 'Breads & Rice'],
    ['Butter Naan', 3, 'Breads & Rice'],
    ['Garlic Naan', 3.5, 'Breads & Rice'],
    ['Cheese Naan', 3.5, 'Breads & Rice'],
    ['Chapati (2)', 3, 'Breads & Rice'],
    ['Steam Rice', 3, 'Breads & Rice'],
    ['Jeera Rice', 7, 'Breads & Rice'],
    ['Pudina Rice', 7, 'Breads & Rice'],

    // ===== EXTRAS =====
    ['Raita / Sauce', 0.99, 'Extras'],
    ['Salad', 1.5, 'Extras'],
    ['Biryani Rice', 6, 'Extras'],
    ['Plain Yogurt', 3, 'Extras'],
    ['Fried Green Chilli', 2, 'Extras'],

    // ===== MANDI =====
    ['Mandi Chicken (1pc)', 18.99, 'Mandi'],
    ['Mandi Goat (1pc)', 19.99, 'Mandi'],
    ['Mandi Nalli Gosht (1pc)', 25, 'Mandi'],

    // ===== DOSA =====
    ['Kadak Ghee Roast', 13, 'Dosas'],
    ['Matka Masala Dosa', 15, 'Dosas'],
    ['Mysore Masala Dosa', 15, 'Dosas'],
    ['Bullet Dosa', 13, 'Dosas'],
    ['Paneer Manpasand', 15, 'Dosas'],
    ['Veg Keema Dosa', 16, 'Dosas'],
    ['Chicken Tikka Dosa', 18, 'Dosas'],
    ['Goat Keema Dosa', 20, 'Dosas'],

    // ===== BEER =====
    ['Any Beer Bottle', 6, 'Beer'],
    ['Taj Mahal Beer', 10, 'Beer'],
    ['Budweiser Draft', 5, 'Beer'],

    // ===== WINE =====
    ['Wycliff Brut Champagne', 30, 'Wine'],
    ['Santa Cristina Pinot Grigio', 30, 'Wine'],
    ['Josh Cabernet Sauvignon', 25, 'Wine'],
    ['Beringer White Zinfandel', 20, 'Wine'],
    ['House Cabernet', 6, 'Wine'],

  ];

  for (const item of items) {
    await query(
      `INSERT INTO "Item" (id, name, description, price, "categoryId", "createdAt")
       VALUES ($1, $2, '', $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [randomUUID(), item[0], item[1], categoryIds[item[2] as string]],
    );
  }

  // ================= MEDIA =================
  await query(
    `INSERT INTO "Media" (id, type, url) VALUES
     ($1, 'hero_image', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b'),
     ($2, 'menu_bg', 'https://www.transparenttextures.com/patterns/carbon-fibre.png')
     ON CONFLICT DO NOTHING`,
    [randomUUID(), randomUUID()],
  );

  console.log('✅ Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());