const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://hsm_sanantonio_user:6C79JgwfkWnRoI3WW9CZbi0YgZbSkcrp@dpg-d7fruhlckfvc73fk8bng-a.virginia-postgres.render.com/hsm_sanantonio?sslmode=require'
});

async function main() {
  await client.connect();
  await client.query('ALTER TABLE "Item" ADD COLUMN "subCategory" TEXT;');
  console.log('Added subCategory column to Item table');
  process.exit(0);
}
main().catch(console.error);