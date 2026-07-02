const db = require('../db');
async function test() {
  try {
    console.log('Running setupDatabase...');
    await db.setupDatabase();
    console.log('Database setup complete. Querying menu_groups...');
    const groups = await db.query('SELECT * FROM menu_groups');
    console.log('Menu Groups in DB:', groups.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
test();
