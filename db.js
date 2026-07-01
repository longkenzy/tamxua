const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_NbrJR84XSpVs@ep-summer-tree-ao7hrpst-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
  max: 2, // Limit pool size to prevent connection exhaustion on Vercel/Neon
  connectionTimeoutMillis: 5000, // Timeout after 5 seconds instead of hanging
  idleTimeoutMillis: 10000, // Close idle clients after 10 seconds
  ssl: {
    rejectUnauthorized: false // Ensure SSL works properly on Vercel/Neon
  }
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', err.message);
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
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
      ALTER TABLE menu ADD COLUMN IF NOT EXISTS image_url TEXT
    `);
    await client.query(`
      ALTER TABLE menu ALTER COLUMN image_url TYPE TEXT
    `);

    // 3. Create tables table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tables (
        id INT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'empty',
        updated_at TIMESTAMP WITH TIME ZONE
      )
    `);    // Add location column if not exists
    await client.query(`
      ALTER TABLE tables ADD COLUMN IF NOT EXISTS location VARCHAR(50) DEFAULT 'trệt'
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

    // Add payment_method column if not exists
    await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash'
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

    // 7. Create menu_groups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      )
    `);

    // 8. Create menu_group_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_group_items (
        menu_group_id INT REFERENCES menu_groups(id) ON DELETE CASCADE,
        item_id VARCHAR(50) REFERENCES menu(id) ON DELETE CASCADE,
        PRIMARY KEY (menu_group_id, item_id)
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
    if (parseInt(tablesCount.rows[0].count) !== 40) {
      await client.query('DELETE FROM order_items');
      await client.query('DELETE FROM tables');
      for (let i = 1; i <= 20; i++) {
        await client.query(`
          INSERT INTO tables (id, name, status, location) VALUES ($1, $2, 'empty', 'trệt')
        `, [i, `Bàn ${i}`]);
      }
      for (let i = 21; i <= 40; i++) {
        await client.query(`
          INSERT INTO tables (id, name, status, location) VALUES ($1, $2, 'empty', 'lầu')
        `, [i, `Bàn ${i}`]);
      }
      console.log('Seeded 40 default tables (20 trệt, 20 lầu).');
    }

    // Seed menu groups and menu items
    const groupsCount = await client.query('SELECT COUNT(*) FROM menu_groups');
    if (parseInt(groupsCount.rows[0].count) === 0) {
      // Clear menu items to start fresh
      await client.query('DELETE FROM order_items');
      await client.query('DELETE FROM menu_group_items');
      await client.query('DELETE FROM menu_groups');
      await client.query('DELETE FROM menu');
      
      const defaultMenu = [
        // COMBO
        { id: "cb1", name: "COMBO 1: Sườn + 1 Món Phụ + Canh Rong Biển (Tiết kiệm 11k)", price: 73000, category: "COMBO", emoji: "🍱", description: "Cơm tấm sườn nướng mật ong kèm 1 món phụ và canh rong biển thịt bằm nóng hổi." },
        { id: "cb2", name: "COMBO 2: Sườn + 2 Món Phụ + Canh Rong Biển ( Tiết kiệm 12k)", price: 83000, category: "COMBO", emoji: "🍱", description: "Cơm tấm sườn nướng mật ong kèm 2 món phụ tự chọn và canh rong biển ngon ngọt." },
        { id: "cb3", name: "COMBO 3: Sườn Bì Chả Trứng + Canh Rong Biển ( Tiết kiệm 12k)", price: 93000, category: "COMBO", emoji: "🍱", description: "Cơm sườn đặc biệt đầy đủ bì, chả chưng trứng thịt và canh rong biển sảng khoái." },
        
        // SƯỜN
        { id: "s1", name: "Cơm Tấm Sườn Không", price: 54000, category: "SƯỜN", emoji: "🍛", description: "Cơm tấm sườn nướng than hồng thơm ngọt đặc trưng Tấm Xưa." },
        { id: "s2", name: "Cơm Tấm Sườn - Trứng", price: 68000, category: "SƯỜN", emoji: "🍛", description: "Cơm tấm sườn nướng kèm trứng ốp la lòng đào béo ngậy." },
        { id: "s3", name: "Cơm Tấm Sườn Chả", price: 68000, category: "SƯỜN", emoji: "🍛", description: "Cơm tấm sườn nướng kèm chả chưng trứng thịt truyền thống." },
        { id: "s4", name: "Cơm Tấm Sườn Bì", price: 68000, category: "SƯỜN", emoji: "🍛", description: "Cơm tấm sườn nướng trộn thính gạo thơm cùng bì heo dai giòn." },
        
        // BA RỌI
        { id: "br1", name: "Cơm Tấm Ba Rọi Không", price: 59000, category: "BA RỌI", emoji: "🍛", description: "Cơm tấm thịt ba chỉ nướng giòn rụm đậm đà." },
        { id: "br2", name: "Cơm Tấm Ba Rọi - Trứng", price: 73000, category: "BA RỌI", emoji: "🍛", description: "Cơm tấm ba rọi nướng cùng trứng ốp la lòng đào." },
        
        // SƯỜN CỌNG
        { id: "sc1", name: "Cơm Tấm Sườn Cọng Không", price: 69000, category: "SƯỜN CỌNG", emoji: "🍖", description: "Cơm tấm sườn cọng nướng tẩm vị thơm ngon." },
        { id: "sc2", name: "Cơm Tấm Sườn Cọng - Trứng", price: 83000, category: "SƯỜN CỌNG", emoji: "🍖", description: "Cơm sườn cọng nướng kèm trứng ốp la." },
        
        // CANH VÀ TOPPING
        { id: "tp1", name: "Canh Rong Biển Thịt Bằm", price: 15000, category: "CANH VÀ TOPPING", emoji: "🍲", description: "Canh rong biển thịt bằm nóng hổi thanh lọc." },
        { id: "tp2", name: "Trứng Ốp La", price: 10000, category: "CANH VÀ TOPPING", emoji: "🍳", description: "Trứng ốp la lòng đào hoặc chín kỹ tùy chọn." },
        { id: "tp3", name: "Bì Thêm", price: 12000, category: "CANH VÀ TOPPING", emoji: "🐷", description: "Bì heo trộn thính gạo rang thơm lừng." },
        { id: "tp4", name: "Chả Trứng Thêm", price: 12000, category: "CANH VÀ TOPPING", emoji: "🥧", description: "Chả chưng trứng thịt nấm mèo đầm vị." },
        
        // CƠM NHÀ TẤM XƯA
        { id: "cn1", name: "Cơm Trắng Thêm", price: 5000, category: "CƠM NHÀ TẤM XƯA", emoji: "🍚", description: "Bát cơm trắng hạt dẻo thơm ăn kèm." },
        { id: "cn2", name: "Cơm Tấm Lòng Đào", price: 45000, category: "CƠM NHÀ TẤM XƯA", emoji: "🍛", description: "Cơm tấm ăn kèm trứng lòng đào đặc biệt của quán." }
      ];

      // Insert menu items
      for (const item of defaultMenu) {
        await client.query(`
          INSERT INTO menu (id, name, price, category, emoji, description) VALUES ($1, $2, $3, $4, $5, $6)
        `, [item.id, item.name, item.price, item.category, item.emoji, item.description]);
      }

      // Create group headers and map items
      const groups = ["COMBO", "SƯỜN", "BA RỌI", "SƯỜN CỌNG", "CANH VÀ TOPPING", "CƠM NHÀ TẤM XƯA"];
      for (const groupName of groups) {
        const insertGroupRes = await client.query(
          'INSERT INTO menu_groups (name) VALUES ($1) RETURNING id',
          [groupName]
        );
        const groupId = insertGroupRes.rows[0].id;
        
        const groupItems = defaultMenu.filter(item => item.category === groupName);
        for (const item of groupItems) {
          await client.query(
            'INSERT INTO menu_group_items (menu_group_id, item_id) VALUES ($1, $2)',
            [groupId, item.id]
          );
        }
      }
      console.log('Seeded menu items and Sapo menu groups.');
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
