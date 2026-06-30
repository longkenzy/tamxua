const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const db = require('./db');
const multer = require('multer');
const mammoth = require('mammoth');

const app = express();

// Multer memory storage configuration to support base64 conversion (avoiding read-only filesystem errors on Vercel)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // Limit image file size to 5MB
  }
});
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const COOKIE_SECRET = 'tamxua-order-secure-cookie-secret-2026';

// Middleware
app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

// Authenticate static pages before serving
app.use((req, res, next) => {
  const urlPath = req.path;
  const role = req.signedCookies.role;

  // Protected pages
  if (urlPath === '/waiter.html') {
    if (!role) return res.redirect('/login.html');
    if (role !== 'waiter' && role !== 'manager') {
      return res.status(403).send('Bạn không có quyền truy cập trang Phục vụ.');
    }
  }

  if (urlPath === '/manager.html') {
    if (!role) return res.redirect('/login.html');
    if (role !== 'manager') {
      return res.status(403).send('Chỉ quản lý mới được quyền truy cập trang này.');
    }
  }

  if (urlPath === '/' || urlPath === '/index.html') {
    if (!role) return res.redirect('/login.html');
  }

  next();
});

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Database helper functions to format data for client
async function getTablesWithOrders() {
  const tablesRes = await db.query('SELECT * FROM tables ORDER BY id');
  const tables = tablesRes.rows;
  
  const orderItemsRes = await db.query(`
    SELECT oi.*, m.name, m.price, m.emoji 
    FROM order_items oi
    JOIN menu m ON oi.menu_id = m.id
    ORDER BY oi.id
  `);
  const orderItems = orderItemsRes.rows;
  
  return tables.map(t => {
    const tableOrder = orderItems
      .filter(oi => oi.table_id === t.id)
      .map(oi => ({
        id: oi.menu_id,
        name: oi.name,
        price: oi.price,
        emoji: oi.emoji,
        quantity: oi.quantity,
        notes: oi.notes || ''
      }));
    return {
      id: t.id,
      name: t.name,
      status: t.status,
      updatedAt: t.updated_at ? t.updated_at.toISOString() : '',
      order: tableOrder
    };
  });
}

async function getTransactionsWithItems() {
  const txRes = await db.query('SELECT * FROM transactions ORDER BY timestamp DESC');
  const txs = txRes.rows;
  
  const itemsRes = await db.query('SELECT * FROM transaction_items ORDER BY id');
  const items = itemsRes.rows;
  
  return txs.map(tx => {
    const txItems = items
      .filter(i => i.transaction_id === tx.id)
      .map(i => ({
        name: i.name,
        emoji: i.emoji,
        price: i.price,
        quantity: i.quantity,
        notes: i.notes || ''
      }));
    return {
      id: tx.id,
      tableId: tx.table_id,
      tableName: tx.table_name,
      subtotal: tx.subtotal,
      receivedAmount: tx.received_amount,
      changeAmount: tx.change_amount,
      discountAmount: tx.discount_amount || 0,
      timestamp: tx.timestamp ? tx.timestamp.toISOString() : '',
      items: txItems
    };
  });
}

// REST APIs
// 1. Authentication Endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đủ thông tin.' });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Tên tài khoản hoặc mật khẩu không chính xác.' });
    }

    // Set signed cookies for session
    res.cookie('role', user.role, { signed: true, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }); // 1 day
    res.cookie('username', user.username, { signed: true, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });

    res.json({ success: true, role: user.role, username: user.username });
  } catch (error) {
    console.error('Lỗi API Login:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Logout Endpoint
app.post('/api/logout', (req, res) => {
  res.clearCookie('role');
  res.clearCookie('username');
  res.json({ success: true });
});

// Middleware to require manager role
function requireManager(req, res, next) {
  const role = req.signedCookies.role;
  if (!role || role !== 'manager') {
    return res.status(403).json({ error: 'Chỉ quản lý mới thực hiện được chức năng này.' });
  }
  next();
}

// Get list of waiter accounts
app.get('/api/users', requireManager, async (req, res) => {
  try {
    const usersRes = await db.query("SELECT id, username, role FROM users WHERE role = 'waiter' ORDER BY username");
    res.json(usersRes.rows);
  } catch (error) {
    console.error('Lỗi lấy danh sách tài khoản:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Create new waiter account
app.post('/api/users', requireManager, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đủ thông tin tài khoản.' });
  }

  const trimmedUsername = username.trim().toLowerCase();
  if (trimmedUsername.length < 3) {
    return res.status(400).json({ error: 'Tên đăng nhập phải chứa ít nhất 3 ký tự.' });
  }

  try {
    // Check if user already exists
    const checkUser = await db.query('SELECT id FROM users WHERE LOWER(username) = $1', [trimmedUsername]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'Tên tài khoản này đã được đăng ký sử dụng.' });
    }

    // Insert user
    await db.query(`
      INSERT INTO users (username, password, role) 
      VALUES ($1, $2, 'waiter')
    `, [username.trim(), password]);

    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi tạo tài khoản nhân viên:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Get menu
app.get('/api/menu', async (req, res) => {
  try {
    const menuRes = await db.query('SELECT * FROM menu ORDER BY category, id');
    res.json(menuRes.rows);
  } catch (error) {
    console.error('Lỗi lấy menu:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Create new food/drink menu item
app.post('/api/menu', requireManager, upload.single('image'), async (req, res) => {
  const { name, price, category, emoji, description } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Tên món ăn, phân loại và giá tiền là bắt buộc.' });
  }

  const id = 'dish-' + Date.now();
  const imageUrl = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;

  try {
    await db.query(`
      INSERT INTO menu (id, name, price, category, emoji, description, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, name, parseInt(price), category, emoji || '🍽️', description || '', imageUrl]);

    // Broadcast updated menu to all clients
    const menuRes = await db.query('SELECT * FROM menu ORDER BY category, id');
    io.emit('menu_updated', menuRes.rows);

    res.json({ success: true, id });
  } catch (error) {
    console.error('Lỗi thêm món ăn:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Update/Edit existing food/drink menu item
app.post('/api/menu/:id', requireManager, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, price, category, emoji, description } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Tên món ăn, phân loại và giá tiền là bắt buộc.' });
  }

  try {
    const checkMenu = await db.query('SELECT image_url FROM menu WHERE id = $1', [id]);
    const existingItem = checkMenu.rows[0];
    if (!existingItem) {
      return res.status(404).json({ error: 'Không tìm thấy món ăn.' });
    }

    let imageUrl = existingItem.image_url;
    if (req.file) {
      imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    await db.query(`
      UPDATE menu 
      SET name = $1, price = $2, category = $3, emoji = $4, description = $5, image_url = $6
      WHERE id = $7
    `, [name, parseInt(price), category, emoji || '🍽️', description || '', imageUrl, id]);

    // Broadcast updated menu to all clients
    const menuRes = await db.query('SELECT * FROM menu ORDER BY category, id');
    io.emit('menu_updated', menuRes.rows);

    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi cập nhật món ăn:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Get tables
app.get('/api/tables', async (req, res) => {
  try {
    const tablesList = await getTablesWithOrders();
    res.json(tablesList);
  } catch (error) {
    console.error('Lỗi lấy bàn ăn:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Get transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const txList = await getTransactionsWithItems();
    res.json(txList);
  } catch (error) {
    console.error('Lỗi lấy lịch sử:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Submit Order
app.post('/api/order', async (req, res) => {
  const { tableId, items } = req.body;
  if (!tableId || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Dữ liệu order không hợp lệ.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Find table
    const tableRes = await client.query('SELECT * FROM tables WHERE id = $1', [tableId]);
    const table = tableRes.rows[0];
    if (!table) {
      throw new Error('Không tìm thấy bàn ăn.');
    }

    // Update table (keep original session start time if already eating)
    await client.query(`
      UPDATE tables 
      SET status = 'eating', 
          updated_at = COALESCE(updated_at, NOW()) 
      WHERE id = $1
    `, [tableId]);

    // Insert/Merge items
    for (const item of items) {
      // Check if duplicate item and note exists
      const checkItem = await client.query(`
        SELECT id FROM order_items 
        WHERE table_id = $1 AND menu_id = $2 AND COALESCE(notes, '') = $3
      `, [tableId, item.id, (item.notes || '').trim()]);
      
      if (checkItem.rows.length > 0) {
        await client.query(`
          UPDATE order_items 
          SET quantity = quantity + $1 
          WHERE id = $2
        `, [parseInt(item.quantity || 1), checkItem.rows[0].id]);
      } else {
        await client.query(`
          INSERT INTO order_items (table_id, menu_id, quantity, notes)
          VALUES ($1, $2, $3, $4)
        `, [tableId, item.id, parseInt(item.quantity || 1), item.notes || '']);
      }
    }

    await client.query('COMMIT');

    // Broadcast update
    const updatedTables = await getTablesWithOrders();
    io.emit('tables_updated', updatedTables);
    io.emit('order_submitted', { tableName: table.name });

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi gọi món:', error);
    res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  } finally {
    client.release();
  }
});

// Checkout table
app.post('/api/checkout', async (req, res) => {
  const { tableId, receivedAmount, discountAmount } = req.body;
  if (!tableId || receivedAmount === undefined || receivedAmount === null) {
    return res.status(400).json({ error: 'Thiếu thông tin thanh toán.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Get table details
    const tableRes = await client.query('SELECT * FROM tables WHERE id = $1', [tableId]);
    const table = tableRes.rows[0];
    if (!table) {
      throw new Error('Không tìm thấy bàn ăn.');
    }

    // Get order items join menu
    const itemsRes = await client.query(`
      SELECT oi.*, m.name, m.price, m.emoji 
      FROM order_items oi
      JOIN menu m ON oi.menu_id = m.id
      WHERE oi.table_id = $1
    `, [tableId]);

    const orderItems = itemsRes.rows;
    if (orderItems.length === 0) {
      throw new Error('Bàn ăn hiện không có món nào để thanh toán.');
    }

    const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = parseInt(discountAmount || 0);
    const finalTotal = Math.max(0, subtotal - discount);
    const changeAmount = parseFloat(receivedAmount) - finalTotal;

    if (changeAmount < 0) {
      throw new Error('Số tiền khách đưa không đủ thanh toán.');
    }

    const txId = `TX-${Date.now()}`;

    // 1. Create Transaction
    await client.query(`
      INSERT INTO transactions (id, table_id, table_name, subtotal, received_amount, change_amount, discount_amount, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [txId, table.id, table.name, subtotal, parseFloat(receivedAmount), changeAmount, discount]);

    // 2. Create Transaction Items
    for (const item of orderItems) {
      await client.query(`
        INSERT INTO transaction_items (transaction_id, name, emoji, price, quantity, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [txId, item.name, item.emoji, item.price, item.quantity, item.notes || '']);
    }

    // 3. Clear Table orders
    await client.query('DELETE FROM order_items WHERE table_id = $1', [tableId]);

    // 4. Reset Table status
    await client.query(`
      UPDATE tables SET status = 'empty', updated_at = NULL WHERE id = $1
    `, [tableId]);

    await client.query('COMMIT');

    // Broadcast updates to all clients
    const updatedTables = await getTablesWithOrders();
    const updatedTxs = await getTransactionsWithItems();
    
    io.emit('tables_updated', updatedTables);
    io.emit('transactions_updated', updatedTxs);

    res.json({ success: true, transaction: { id: txId, changeAmount } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi thanh toán:', error);
    res.status(500).json({ error: error.message || 'Lỗi hệ thống.' });
  } finally {
    client.release();
  }
});

// Generate and print Word docx invoice
app.post('/api/print-docx', async (req, res) => {
  try {
    const templateData = req.body;
    
    // Path to the docx template
    const templatePath = path.join(__dirname, 'templates', 'hoadon.docx');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Không tìm thấy file hoadon.docx trong thư mục templates.' });
    }
    
    // Load Word template file as binary
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Populate data
    doc.render(templateData);

    // Generate output buffer
    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // Convert populated DOCX buffer to HTML
    const htmlResult = await mammoth.convertToHtml({ buffer: buf });
    const bodyHtml = htmlResult.value;

    // Wrap with print styling optimized for thermal K80 paper
    const styledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 13px;
              width: 80mm;
              margin: 0 auto;
              padding: 2mm 4mm;
              color: #000;
              background-color: #fff;
              line-height: 1.4;
            }
            p {
              margin: 6px 0;
              text-align: center;
            }
            table ~ p {
              text-align: left;
            }
            body > p:last-child {
              text-align: center;
              margin-top: 15px;
              font-style: italic;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 12px 0;
            }
            table, th, td {
              border: 1px solid #000;
            }
            th, td {
              padding: 6px 8px;
              font-size: 12px;
              vertical-align: middle;
            }
            tr:first-child td, tr:first-child th, th {
              font-weight: bold !important;
              background-color: #f9f9f9;
            }
            /* Column alignments */
            td:nth-child(1), th:nth-child(1) {
              text-align: left;
            }
            td:nth-child(2), th:nth-child(2) {
              text-align: right;
            }
            td:nth-child(3), th:nth-child(3) {
              text-align: center;
            }
            td:nth-child(4), th:nth-child(4) {
              text-align: right;
            }
            h1, h2, h3, h4, h5, p[style*="text-align:center"] {
              text-align: center !important;
              margin: 6px 0;
            }
            p strong {
              font-weight: bold;
            }
            @page {
              margin: 0;
            }
          </style>
        </head>
        <body>
          ${bodyHtml}
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(styledHtml);
  } catch (error) {
    console.error('Lỗi sinh file Word hóa đơn:', error);
    res.status(500).json({ error: 'Không thể sinh file Word hóa đơn.' });
  }
});

// Socket.io Real-time connections
io.on('connection', async (socket) => {
  try {
    const tablesList = await getTablesWithOrders();
    const txList = await getTransactionsWithItems();
    socket.emit('tables_updated', tablesList);
    socket.emit('transactions_updated', txList);
  } catch (err) {
    console.error('Socket init error:', err);
  }
});

// Start Server with Database Setup
db.setupDatabase().then(() => {
  if (!process.env.VERCEL) {
    server.listen(PORT, () => {
      console.log(`Server is running in real-time at http://localhost:${PORT}`);
    });
  }
}).catch(err => {
  console.error('Database connection failed. Exiting...', err);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
});

module.exports = app;
