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
    if (role === 'waiter') return res.redirect('/waiter.html');
    if (role === 'manager') return res.redirect('/manager.html');
  }

  next();
});

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Database helper functions to format data for client
async function getTablesWithOrders() {
  const res = await db.query(`
    SELECT t.id, t.name, t.status, t.location, t.updated_at,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', m.id,
                 'name', m.name,
                 'price', COALESCE(oi.price, m.price, 0),
                 'emoji', m.emoji,
                 'quantity', oi.quantity,
                 'notes', COALESCE(oi.notes, '')
               )
             ) FILTER (WHERE oi.id IS NOT NULL),
             '[]'::json
           ) as "order"
    FROM tables t
    LEFT JOIN order_items oi ON t.id = oi.table_id
    LEFT JOIN menu m ON oi.menu_id = m.id
    GROUP BY t.id, t.name, t.status, t.location, t.updated_at
    ORDER BY t.id;
  `);

  return res.rows.map(row => ({
    id: row.id,
    name: row.name,
    status: row.status,
    location: row.location || 'trệt',
    updatedAt: row.updated_at ? row.updated_at.toISOString() : '',
    order: row.order
  }));
}

async function getTransactionsWithItems() {
  const res = await db.query(`
    SELECT tx.id, tx.table_id as "tableId", tx.table_name as "tableName", 
           tx.subtotal, tx.received_amount as "receivedAmount", 
           tx.change_amount as "changeAmount", tx.discount_amount as "discountAmount", 
           tx.payment_method as "paymentMethod", tx.timestamp,
           COALESCE(
             json_agg(
               json_build_object(
                 'name', ti.name,
                 'emoji', ti.emoji,
                 'price', ti.price,
                 'quantity', ti.quantity,
                 'notes', COALESCE(ti.notes, '')
               )
             ) FILTER (WHERE ti.id IS NOT NULL),
             '[]'::json
           ) as items
    FROM transactions tx
    LEFT JOIN transaction_items ti ON tx.id = ti.transaction_id
    GROUP BY tx.id, tx.table_id, tx.table_name, tx.subtotal, tx.received_amount, tx.change_amount, tx.discount_amount, tx.payment_method, tx.timestamp
    ORDER BY tx.timestamp DESC;
  `);

  return res.rows.map(row => ({
    id: row.id,
    tableId: row.tableId,
    tableName: row.tableName,
    subtotal: row.subtotal,
    receivedAmount: row.receivedAmount,
    changeAmount: row.changeAmount,
    discountAmount: row.discountAmount || 0,
    paymentMethod: row.paymentMethod || 'cash',
    timestamp: row.timestamp ? row.timestamp.toISOString() : '',
    items: row.items
  }));
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

// Middleware to require logged in user (manager or waiter)
function requireAuth(req, res, next) {
  const role = req.signedCookies.role;
  if (!role || (role !== 'manager' && role !== 'waiter')) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập để thực hiện chức năng này.' });
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

// Bulk import menu items from Excel data (already parsed on client-side)
app.post('/api/menu-import', requireManager, async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Danh sách mặt hàng không hợp lệ.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of items) {
      const { name, price, description, category, emoji, imageUrlLink } = item;
      if (!name || price === undefined || price === null) {
        throw new Error('Tên món ăn và giá bán là bắt buộc cho tất cả mặt hàng.');
      }

      const cleanPrice = parseInt(price);
      if (isNaN(cleanPrice) || cleanPrice < 0) {
        throw new Error(`Giá bán của món "${name}" không hợp lệ.`);
      }

      // Generate a highly unique ID using timestamp and random suffix
      const id = 'dish-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const finalCategory = category ? category.trim() : 'main';
      const finalEmoji = emoji ? emoji.trim() : '🍽️';
      const finalDesc = description ? description.trim() : '';
      const finalImg = imageUrlLink ? imageUrlLink.trim() : null;

      await client.query(`
        INSERT INTO menu (id, name, price, category, emoji, description, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [id, name.trim(), cleanPrice, finalCategory, finalEmoji, finalDesc, finalImg]);

      // Tự động tìm hoặc tạo nhóm thực đơn (menu_groups) và liên kết món ăn vào nhóm đó
      if (finalCategory) {
        let groupId;
        const groupCheck = await client.query(
          'SELECT id FROM menu_groups WHERE TRIM(UPPER(name)) = TRIM(UPPER($1))', 
          [finalCategory]
        );
        if (groupCheck.rows.length > 0) {
          groupId = groupCheck.rows[0].id;
        } else {
          try {
            // Tạo nhóm thực đơn mới nếu chưa có
            const insertGroupRes = await client.query(
              'INSERT INTO menu_groups (name) VALUES ($1) RETURNING id',
              [finalCategory]
            );
            groupId = insertGroupRes.rows[0].id;
          } catch (grpErr) {
            // Nếu có lỗi do trùng lặp đồng thời (unique constraint), tìm lại nhóm hiện tại
            if (grpErr.code === '23505') {
              const retryCheck = await client.query(
                'SELECT id FROM menu_groups WHERE TRIM(UPPER(name)) = TRIM(UPPER($1))', 
                [finalCategory]
              );
              if (retryCheck.rows.length > 0) {
                groupId = retryCheck.rows[0].id;
              } else {
                throw grpErr;
              }
            } else {
              throw grpErr;
            }
          }
        }

        // Liên kết món ăn vào nhóm thực đơn
        await client.query(
          'INSERT INTO menu_group_items (menu_group_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [groupId, id]
        );
      }
    }

    await client.query('COMMIT');

    // Broadcast updated menu to all clients (can use general query now since connection is outside the transaction loop)
    const menuRes = await db.query('SELECT * FROM menu ORDER BY category, id');
    io.emit('menu_updated', menuRes.rows);
    io.emit('menu_groups_updated');

    res.json({ success: true, count: items.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi nhập thực đơn từ Excel:', error);
    res.status(400).json({ error: error.message || 'Lỗi hệ thống khi nhập Excel.' });
  } finally {
    client.release();
  }
});

// Create new food/drink menu item
app.post('/api/menu', requireManager, upload.single('image'), async (req, res) => {
  const { name, price, category, emoji, description, imageUrlLink } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Tên món ăn, phân loại và giá tiền là bắt buộc.' });
  }

  const id = 'dish-' + Date.now();
  let imageUrl = null;
  if (req.file) {
    imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  } else if (imageUrlLink) {
    imageUrl = imageUrlLink.trim();
  }

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

app.post('/api/menu/:id', requireManager, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const cleanId = id.trim();
  const { name, price, category, emoji, description, imageUrlLink, removeImage } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Tên món ăn, phân loại và giá tiền là bắt buộc.' });
  }

  try {
    const checkMenu = await db.query('SELECT image_url FROM menu WHERE TRIM(id) = $1', [cleanId]);
    const existingItem = checkMenu.rows[0];
    if (!existingItem) {
      return res.status(404).json({ error: 'Không tìm thấy món ăn.' });
    }

    let imageUrl = existingItem.image_url;
    if (req.file) {
      imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    } else if (imageUrlLink) {
      imageUrl = imageUrlLink.trim();
    } else if (removeImage === 'true') {
      imageUrl = null;
    }

    await db.query(`
      UPDATE menu 
      SET name = $1, price = $2, category = $3, emoji = $4, description = $5, image_url = $6
      WHERE TRIM(id) = $7
    `, [name, parseInt(price), category, emoji || '🍽️', description || '', imageUrl, cleanId]);

    // Broadcast updated menu to all clients
    const menuRes = await db.query('SELECT * FROM menu ORDER BY category, id');
    io.emit('menu_updated', menuRes.rows);

    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi cập nhật món ăn:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Delete all food/drink menu items
app.delete('/api/menu-all', requireManager, async (req, res) => {
  try {
    // 1. Clear all active order items
    await db.query('DELETE FROM order_items');

    // 2. Reset all table statuses to empty
    await db.query("UPDATE tables SET status = 'empty', updated_at = NULL");

    // 3. Delete all menu items (will cascade to menu_group_items)
    await db.query('DELETE FROM menu');

    // 4. Broadcast updated menu and tables list to all clients
    const menuRes = await db.query('SELECT * FROM menu ORDER BY category, id');
    io.emit('menu_updated', menuRes.rows);

    const updatedTables = await getTablesWithOrders();
    io.emit('tables_updated', updatedTables);

    res.json({ success: true, message: 'Đã xóa tất cả các món ăn trong thực đơn.' });
  } catch (error) {
    console.error('Lỗi xóa tất cả món ăn:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Delete food/drink menu item
app.delete('/api/menu/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  const cleanId = id.trim();
  try {
    // 1. Delete active order items referencing this dish
    await db.query('DELETE FROM order_items WHERE TRIM(menu_id) = $1', [cleanId]);

    // 2. Delete the menu item itself
    const deleteRes = await db.query('DELETE FROM menu WHERE TRIM(id) = $1', [cleanId]);
    if (deleteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy món ăn.' });
    }

    // 3. Broadcast updated menu and tables list
    const menuRes = await db.query('SELECT * FROM menu ORDER BY category, id');
    io.emit('menu_updated', menuRes.rows);

    const updatedTables = await getTablesWithOrders();
    io.emit('tables_updated', updatedTables);

    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi xóa món ăn:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Get menu groups
app.get('/api/menu-groups', async (req, res) => {
  try {
    const groupsRes = await db.query('SELECT * FROM menu_groups ORDER BY id');
    const itemsRes = await db.query(`
      SELECT mgi.menu_group_id, m.* 
      FROM menu_group_items mgi 
      JOIN menu m ON mgi.item_id = m.id
      ORDER BY mgi.menu_group_id, m.category, m.id
    `);

    const groups = groupsRes.rows.map(g => ({
      id: g.id,
      name: g.name,
      items: itemsRes.rows.filter(i => i.menu_group_id === g.id)
    }));
    res.json(groups);
  } catch (error) {
    console.error('Lỗi lấy nhóm thực đơn:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Create menu group
app.post('/api/menu-groups', requireManager, async (req, res) => {
  const { name, itemIds } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Tên thực đơn là bắt buộc.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const insertGroupRes = await client.query(
      'INSERT INTO menu_groups (name) VALUES ($1) RETURNING id',
      [name]
    );
    const newGroupId = insertGroupRes.rows[0].id;

    if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      for (const itemId of itemIds) {
        await client.query(
          'INSERT INTO menu_group_items (menu_group_id, item_id) VALUES ($1, $2)',
          [newGroupId, itemId]
        );
      }
    }

    await client.query('COMMIT');

    // Broadcast updated groups to all clients
    io.emit('menu_groups_updated');

    res.json({ success: true, id: newGroupId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi tạo nhóm thực đơn:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Tên thực đơn đã tồn tại.' });
    } else {
      res.status(500).json({ error: 'Lỗi hệ thống.' });
    }
  } finally {
    client.release();
  }
});

// Update menu group
app.put('/api/menu-groups/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  const { name, itemIds } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Tên thực đơn là bắt buộc.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Update name
    await client.query(
      'UPDATE menu_groups SET name = $1 WHERE id = $2',
      [name, parseInt(id)]
    );

    // Delete existing links
    await client.query('DELETE FROM menu_group_items WHERE menu_group_id = $1', [parseInt(id)]);

    // Insert new links
    if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      for (const itemId of itemIds) {
        await client.query(
          'INSERT INTO menu_group_items (menu_group_id, item_id) VALUES ($1, $2)',
          [parseInt(id), itemId]
        );
      }
    }

    await client.query('COMMIT');

    // Broadcast updated groups to all clients
    io.emit('menu_groups_updated');

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi cập nhật nhóm thực đơn:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Tên thực đơn đã tồn tại.' });
    } else {
      res.status(500).json({ error: 'Lỗi hệ thống.' });
    }
  } finally {
    client.release();
  }
});

// Delete menu group
app.delete('/api/menu-groups/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM menu_groups WHERE id = $1', [parseInt(id)]);
    io.emit('menu_groups_updated');
    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi xóa nhóm thực đơn:', error);
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
// Add a new table
app.post('/api/tables', requireAuth, async (req, res) => {
  const { name, location } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tên số bàn không được để trống.' });
  }
  const cleanName = name.trim();
  const validLocations = ['trệt', 'lầu', 'máy lạnh', 'mang về', 'giao hàng', 'đối tác'];
  let cleanLocation = (location || 'trệt').trim().toLowerCase();
  if (!validLocations.includes(cleanLocation)) {
    return res.status(400).json({ error: 'Vị trí không hợp lệ. Vui lòng chọn một trong: trệt, lầu, máy lạnh, mang về, giao hàng, đối tác.' });
  }

  try {
    // 1. Check if table name already exists (case-insensitive)
    const existsRes = await db.query('SELECT 1 FROM tables WHERE LOWER(name) = LOWER($1)', [cleanName]);
    if (existsRes.rowCount > 0) {
      return res.status(400).json({ error: 'Số bàn này đã tồn tại.' });
    }

    // 2. Programmatically determine next primary key ID
    const maxIdRes = await db.query('SELECT MAX(id) AS max_id FROM tables');
    const nextId = (maxIdRes.rows[0].max_id || 0) + 1;

    // 3. Insert new table
    await db.query("INSERT INTO tables (id, name, status, location) VALUES ($1, $2, 'empty', $3)", [nextId, cleanName, cleanLocation]);

    // 3. Broadcast updated tables list to all clients
    const updatedTables = await getTablesWithOrders();
    io.emit('tables_updated', updatedTables);

    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi khi thêm bàn ăn:', error);
    res.status(500).json({ error: 'Lỗi hệ thống khi thêm bàn ăn.' });
  }
});

// Delete a table
app.delete('/api/tables/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Verify if the table has active order items
    const checkRes = await db.query('SELECT status FROM tables WHERE id = $1', [id]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy bàn ăn.' });
    }

    if (checkRes.rows[0].status === 'eating') {
      return res.status(400).json({ error: 'Không thể xóa bàn đang có khách dùng.' });
    }

    // 2. Delete table
    await db.query('DELETE FROM tables WHERE id = $1', [id]);

    // 3. Broadcast updated tables list
    const updatedTables = await getTablesWithOrders();
    io.emit('tables_updated', updatedTables);

    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi khi xóa bàn ăn:', error);
    res.status(500).json({ error: 'Lỗi hệ thống khi xóa bàn ăn.' });
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
});// Delete transaction
app.delete('/api/transactions/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRes = await db.query('DELETE FROM transactions WHERE id = $1', [id]);
    if (deleteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy hóa đơn.' });
    }

    // Broadcast updated transactions to all clients
    const txList = await getTransactionsWithItems();
    io.emit('transactions_updated', txList);

    res.json({ success: true, message: 'Đã xóa hóa đơn thành công.' });
  } catch (error) {
    console.error('Lỗi khi xóa hóa đơn:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});
// Bulk delete transactions
app.delete('/api/transactions-bulk', requireManager, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Không tìm thấy danh sách hóa đơn để xóa.' });
  }

  try {
    const deleteRes = await db.query('DELETE FROM transactions WHERE id = ANY($1)', [ids]);

    // Broadcast updated transactions list to all clients
    const txList = await getTransactionsWithItems();
    io.emit('transactions_updated', txList);

    res.json({ success: true, count: deleteRes.rowCount });
  } catch (error) {
    console.error('Lỗi khi xóa hàng loạt hóa đơn:', error);
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

    // Clear existing items for this table first
    await client.query('DELETE FROM order_items WHERE table_id = $1', [tableId]);

    if (items.length === 0) {
      // If order is cleared, reset table to empty
      await client.query("UPDATE tables SET status = 'empty', updated_at = NULL WHERE id = $1", [tableId]);
    } else {
      // Update table to eating
      await client.query(`
        UPDATE tables 
        SET status = 'eating', 
            updated_at = COALESCE(updated_at, NOW()) 
        WHERE id = $1
      `, [tableId]);

      // Insert all updated items
      for (const item of items) {
        if (item.quantity > 0) {
          await client.query(`
            INSERT INTO order_items (table_id, menu_id, quantity, price, notes)
            VALUES ($1, $2, $3, $4, $5)
          `, [tableId, item.id, parseInt(item.quantity || 1), parseInt(item.price || 0), item.notes || '']);
        }
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
  const { tableId, receivedAmount, discountAmount, paymentMethod } = req.body;
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
      SELECT oi.id, oi.table_id, oi.menu_id, oi.quantity, oi.notes, 
             m.name, COALESCE(oi.price, m.price, 0) as price, m.emoji 
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
      INSERT INTO transactions (id, table_id, table_name, subtotal, received_amount, change_amount, discount_amount, payment_method, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [txId, table.id, table.name, subtotal, parseFloat(receivedAmount), changeAmount, discount, paymentMethod || 'cash']);

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
    const [updatedTables, updatedTxs] = await Promise.all([
      getTablesWithOrders(),
      getTransactionsWithItems()
    ]);
    io.emit('tables_updated', updatedTables);
    io.emit('transactions_updated', updatedTxs);
    io.emit('checkout_completed', { tableName: table.name });

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
              margin: 1px 0;
              text-align: center;
            }
            table ~ p {
              text-align: left;
            }
            body > p:last-child {
              text-align: center;
              margin-top: 6px;
              font-style: italic;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 6px 0;
            }
            table, th, td {
              border: 1px solid #000;
            }
            th, td {
              padding: 0px 1px;
              font-size: 12px;
              vertical-align: middle;
            }
            td p, th p {
              text-align: inherit;
              margin: 0;
            }
            tr:first-child td, tr:first-child th, th {
              font-weight: bold !important;
              background-color: #f9f9f9;
              text-align: center !important;
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

// Start Server with Database Setup (Only run setupDatabase and server.listen if not on Vercel)
if (!process.env.VERCEL) {
  db.setupDatabase().then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running in real-time at http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('Database connection failed. Exiting...', err);
    process.exit(1);
  });
}

module.exports = app;
