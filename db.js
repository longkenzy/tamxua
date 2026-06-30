const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_NbrJR84XSpVs@ep-summer-tree-ao7hrpst-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
}

// Automatically create tables and seed them if empty
async function setupDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL
      )
    `);

    // 2. Create menu table
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price INT NOT NULL,
        category VARCHAR(50) NOT NULL,
        emoji VARCHAR(10) NOT NULL,
        description TEXT
      )
    `);

    // Add image_url column if not exists
    await client.query(`
      ALTER TABLE menu ADD COLUMN IF NOT EXISTS image_url VARCHAR(255)
    `);

    // 3. Create tables table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tables (
        id INT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'empty',
        updated_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // 4. Create order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        table_id INT REFERENCES tables(id) ON DELETE CASCADE,
        menu_id VARCHAR(50) REFERENCES menu(id),
        quantity INT NOT NULL DEFAULT 1,
        notes TEXT
      )
    `);

    // 5. Create transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(50) PRIMARY KEY,
        table_id INT NOT NULL,
        table_name VARCHAR(50) NOT NULL,
        subtotal INT NOT NULL,
        received_amount INT NOT NULL,
        change_amount INT NOT NULL,
        discount_amount INT DEFAULT 0,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add discount_amount column if not exists
    await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_amount INT DEFAULT 0
    `);

    // 6. Create transaction_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id SERIAL PRIMARY KEY,
        transaction_id VARCHAR(50) REFERENCES transactions(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        emoji VARCHAR(10) NOT NULL,
        price INT NOT NULL,
        quantity INT NOT NULL,
        notes TEXT
      )
    `);

    // Migrate old categories to new categories if they exist
    await client.query("UPDATE menu SET category = 'main' WHERE category IN ('noodle', 'bread')");
    await client.query("UPDATE menu SET category = 'side' WHERE category = 'appetizer'");

    await client.query('COMMIT');
    console.log('PostgreSQL database schemas created successfully.');

    // Seed Data
    // Seed users
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO users (username, password, role) VALUES 
        ('waiter', 'waiter123', 'waiter'),
        ('manager', 'manager123', 'manager')
      `);
      console.log('Seeded default users (waiter/waiter123, manager/manager123).');
    }

    // Seed tables
    const tablesCount = await client.query('SELECT COUNT(*) FROM tables');
    if (parseInt(tablesCount.rows[0].count) === 0) {
      for (let i = 1; i <= 10; i++) {
        await client.query(`
          INSERT INTO tables (id, name, status) VALUES ($1, $2, 'empty')
        `, [i, `Bàn ${i}`]);
      }
      console.log('Seeded 10 default tables (Bàn 1 - 10).');
    }

    // Seed menu
    const menuCount = await client.query('SELECT COUNT(*) FROM menu');
    if (parseInt(menuCount.rows[0].count) === 0) {
      const defaultMenu = [
        { id: "pho_bo", name: "Phở Bò Đặc Biệt", price: 65000, category: "main", emoji: "🍜", description: "Phở bò tái chín truyền thống, nước dùng hầm xương 24h đậm đà." },
        { id: "pho_ga", name: "Phở Gà Ta", price: 60000, category: "main", emoji: "🍲", description: "Phở gà ta xé phay, nước dùng thanh ngọt thơm mùi lá chanh." },
        { id: "bun_cha", name: "Bún Chả Hà Nội", price: 55000, category: "main", emoji: "🥗", description: "Chả nướng than hoa thơm lừng, ăn kèm bún sợi nhỏ và nước mắm chua ngọt." },
        { id: "banh_mi", name: "Bánh Mì Hội An", price: 35000, category: "main", emoji: "🥖", description: "Bánh mì giòn rụm với pate gan, xá xíu, chả lụa và nước sốt đặc trưng." },
        { id: "goi_cuon", name: "Gỏi Cuốn Tôm Thịt (3 cái)", price: 30000, category: "side", emoji: "🌯", description: "Tôm tươi, thịt ba chỉ luộc, rau sống cuộn trong bánh tráng kèm nước chấm tương đen." },
        { id: "nem_ran", name: "Nem Rán Hà Nội (4 cái)", price: 40000, category: "side", emoji: "🍘", description: "Nem nhân thịt băm, mộc nhĩ, miến dong chiên giòn tan." },
        { id: "cafe_sua_da", name: "Cà Phê Sữa Đá", price: 25000, category: "drink", emoji: "🥤", description: "Cà phê phin Robusta đậm chất kết hợp sữa đặc và đá xay." },
        { id: "tra_dao", name: "Trà Đào Sả Vải", price: 35000, category: "drink", emoji: "🍹", description: "Trà đào mát lạnh thơm sả, kèm quả đào và vải ngâm giòn ngọt." },
        { id: "sinh_to_bo", name: "Sinh Tố Bơ Sáp", price: 45000, category: "drink", emoji: "🥑", description: "Bơ sáp Đắk Lắk xay nhuyễn với sữa tươi và sữa đặc béo ngậy." },
        { id: "nuoc_ngot", name: "Coca / Pepsi / Sprite", price: 15000, category: "drink", emoji: "🥤", description: "Các loại nước ngọt đóng lon phục vụ kèm đá lạnh." }
      ];

      for (const item of defaultMenu) {
        await client.query(`
          INSERT INTO menu (id, name, price, category, emoji, description) VALUES ($1, $2, $3, $4, $5, $6)
        `, [item.id, item.name, item.price, item.category, item.emoji, item.description]);
      }
      console.log('Seeded menu items.');
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error setting up database schemas:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  setupDatabase
};
