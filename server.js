const express = require('express');
const http = require('http');
const net = require('net');
const os = require('os');
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

// Ghi Process ID ra file để hỗ trợ tắt server chạy ngầm
try {
  fs.writeFileSync(path.join(__dirname, 'server.pid'), process.pid.toString());
} catch (err) {
  console.error('Không thể ghi file server.pid:', err.message);
}

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
app.use('/templates', express.static(path.join(__dirname, 'templates')));

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

// Get current logged in user profile
app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    username: req.signedCookies.username || 'Nhân viên',
    role: req.signedCookies.role || 'waiter'
  });
});


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

// Delete waiter account
app.delete('/api/users/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  try {
    const checkUser = await db.query('SELECT id, role FROM users WHERE id = $1', [parseInt(id)]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản nhân viên.' });
    }
    if (checkUser.rows[0].role !== 'waiter') {
      return res.status(400).json({ error: 'Chỉ có thể xoá tài khoản nhân viên phục vụ.' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [parseInt(id)]);
    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi xoá tài khoản nhân viên:', error);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// Change password for manager account
app.post('/api/change-password', async (req, res) => {
  const role = req.signedCookies.role;
  const username = req.signedCookies.username;

  if (!role || !username) {
    return res.status(401).json({ error: 'Chưa đăng nhập.' });
  }

  if (role !== 'manager') {
    return res.status(403).json({ error: 'Chỉ tài khoản quản lý mới có quyền thực hiện chức năng này.' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng điền đủ thông tin.' });
  }

  try {
    // Verify current password
    const userRes = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, currentPassword]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
    }

    // Update password
    await db.query('UPDATE users SET password = $1 WHERE username = $2', [newPassword, username]);

    res.json({ success: true });
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error);
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
    if (items.length > 0) {
      io.emit('order_submitted', { tableName: table.name });
    } else {
      io.emit('order_cancelled', { tableName: table.name });
    }

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

// Helper to generate docx buffer from template and data
function generateDocxBuffer(templateName, templateData) {
  const templatePath = path.join(__dirname, 'templates', templateName);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Không tìm thấy file ${templateName} trong thư mục templates.`);
  }
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.render(templateData);
  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
}

// Silent direct system print using Word in the background
function printDocxOnServer(printerName, templateName, templateData) {
  return new Promise((resolve, reject) => {
    const scratchDir = path.join(__dirname, 'scratch');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
    
    const tempFile = path.join(scratchDir, `print_job_${Date.now()}.docx`);
    
    try {
      const buf = generateDocxBuffer(templateName, templateData);
      fs.writeFileSync(tempFile, buf);
    } catch (e) {
      return reject(e);
    }

    // Escape single quotes for PowerShell
    const escapedPrinterName = printerName ? printerName.replace(/'/g, "''") : '';
    const escapedTempFile = tempFile.replace(/'/g, "''");
    
    // Calculate dynamic page height in points to avoid wasting thermal paper
    let numItems = 0;
    if (templateData && Array.isArray(templateData.items)) {
      numItems = templateData.items.length;
    }
    
    let pageHeight = 842; // default A4 height in points
    if (templateName === 'hoadonbep.docx') {
      pageHeight = 380 + (numItems * 30);
      if (pageHeight < 400) pageHeight = 400;
    } else {
      pageHeight = 660 + (numItems * 30);
      if (pageHeight < 700) pageHeight = 700;
    }
    
    let psCommand = `$word = New-Object -ComObject Word.Application; $word.Visible = $false; $word.DisplayAlerts = 0; try { $doc = $word.Documents.Open('${escapedTempFile}'); `;
    psCommand += `$doc.PageSetup.Orientation = 0; `;
    psCommand += `$doc.PageSetup.PageHeight = ${pageHeight}; `;
    
    if (escapedPrinterName) {
      psCommand += `$word.ActivePrinter = '${escapedPrinterName}'; `;
    }
    psCommand += `$doc.PrintOut($false); $doc.Close(); } finally { $word.Quit(); }`;
    
    const { execFile } = require('child_process');
    execFile('powershell', ['-NoProfile', '-Command', psCommand], { encoding: 'utf8' }, (err, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch (e) {}
      
      if (err) {
        console.error('Lỗi in DOCX qua Word:', err, stderr);
        return reject(new Error(`Lỗi khi in qua Word: ${err.message}`));
      }
      resolve({ success: true, message: `Đã in file mẫu thành công qua Word` });
    });
  });
}

// Endpoint to silently print docx using Word in the background
app.post('/api/print-docx-silent', requireAuth, async (req, res) => {
  const { sharedPath, template, templateData } = req.body;
  const templateName = template === 'hoadonbep.docx' ? 'hoadonbep.docx' : 'hoadon.docx';
  
  try {
    const result = await printDocxOnServer(sharedPath, templateName, templateData);
    res.json(result);
  } catch (error) {
    console.error('Silent print docx error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate and print Word docx invoice
app.post('/api/print-docx', async (req, res) => {
  try {
    const { template, ...templateData } = req.body;
    const templateName = template === 'hoadonbep.docx' ? 'hoadonbep.docx' : 'hoadon.docx';

    const buf = generateDocxBuffer(templateName, templateData);

    // Convert populated DOCX buffer to HTML
    const htmlResult = await mammoth.convertToHtml({ buffer: buf });
    const bodyHtml = htmlResult.value;

    // Wrap with print styling optimized for thermal K80 paper
    const styledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Roboto', Arial, sans-serif;
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
              padding: 4px 6px;
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

// Endpoint to fetch system printers on Windows
app.get('/api/system-printers', requireAuth, (req, res) => {
  const { execFile } = require('child_process');
  execFile('powershell', [
    '-NoProfile',
    '-Command',
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name'
  ], { encoding: 'utf8' }, (err, stdout, stderr) => {
    if (err) {
      console.error('Lỗi lấy danh sách máy in:', err, stderr);
      return res.status(500).json({ error: `Không thể quét danh sách máy in: ${err.message}` });
    }
    const printers = stdout.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    res.json(printers);
  });
});

// Helper function to print raw commands directly on server
function printRawOnServer(printerType, sharedPath, ip, port, content) {
  return new Promise((resolve, reject) => {
    if (printerType === 'wifi') {
      if (!ip) {
        return reject(new Error('Địa chỉ IP máy in Wifi không được trống.'));
      }
      const printerPort = parseInt(port) || 9100;
      const client = new net.Socket();
      client.setTimeout(4000); // 4 seconds timeout

      let printContent = content;
      if (!printContent.endsWith('\x1b\x69')) {
        printContent += '\n\n\n\n\n\x1b\x69';
      }

      client.connect(printerPort, ip, () => {
        client.write(Buffer.from(printContent, 'utf-8'), () => {
          client.end();
          resolve({ success: true, message: `Đã gửi lệnh in đến máy in Wifi ${ip}:${printerPort}` });
        });
      });

      client.on('error', (err) => {
        client.destroy();
        console.error('Lỗi in Wifi:', err);
        reject(new Error(`Không thể kết nối đến máy in Wifi tại ${ip}:${printerPort}. Lỗi: ${err.message}`));
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error(`Kết nối đến máy in Wifi tại ${ip}:${printerPort} bị quá hạn (Timeout).`));
      });

    } else if (printerType === 'shared') {
      if (!sharedPath) {
        return reject(new Error('Đường dẫn máy in chia sẻ (Shared Path) không được trống.'));
      }

      const scratchDir = path.join(__dirname, 'scratch');
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
      }
      
      const tempFile = path.join(scratchDir, `print_job_${Date.now()}.txt`);
      
      let printContent = content;
      if (!printContent.endsWith('\x1b\x69')) {
        printContent += '\n\n\n\n\n\x1b\x69';
      }

      try {
        fs.writeFileSync(tempFile, printContent, 'utf-8');
        const { execFile } = require('child_process');
        execFile('cmd.exe', ['/c', 'copy', '/B', tempFile, sharedPath], (err, stdout, stderr) => {
          try { fs.unlinkSync(tempFile); } catch (e) {}

          if (err) {
            console.error('Lỗi in Shared Printer:', err, stderr);
            return reject(new Error(`Lỗi khi in qua máy in chia sẻ: ${err.message}`));
          }
          resolve({ success: true, message: `Đã gửi lệnh in đến máy in chia sẻ ${sharedPath}` });
        });
      } catch (e) {
        reject(e);
      }

    } else if (printerType === 'system') {
      const scratchDir = path.join(__dirname, 'scratch');
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
      }
      
      const tempFile = path.join(scratchDir, `print_job_${Date.now()}.txt`);
      
      let printContent = content.replace(/\x1b\x69/g, '');

      try {
        fs.writeFileSync(tempFile, printContent, 'utf-8');
        const psCommand = sharedPath
          ? `Get-Content -LiteralPath '${tempFile}' -Encoding utf8 | Out-Printer -Name '${sharedPath.replace(/'/g, "''")}'`
          : `Get-Content -LiteralPath '${tempFile}' -Encoding utf8 | Out-Printer`;
        
        const { execFile } = require('child_process');
        execFile('powershell', ['-NoProfile', '-Command', psCommand], { encoding: 'utf8' }, (err, stdout, stderr) => {
          try { fs.unlinkSync(tempFile); } catch (e) {}

          if (err) {
            console.error('Lỗi in System Printer:', err, stderr);
            return reject(new Error(`Lỗi khi in qua máy in hệ thống: ${err.message}`));
          }
          resolve({ success: true, message: sharedPath ? `Đã gửi lệnh in đến máy in hệ thống ${sharedPath}` : 'Đã gửi lệnh in đến máy in mặc định' });
        });
      } catch (e) {
        reject(e);
      }
    } else {
      reject(new Error('Loại kết nối máy in không hợp lệ (Chỉ hỗ trợ wifi, shared hoặc system).'));
    }
  });
}

// Endpoint to fetch printer settings
app.get('/api/printer-settings', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM printer_settings');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching printer settings:', error);
    res.status(500).json({ error: 'Failed to fetch printer settings' });
  }
});

// Endpoint to save/update printer settings
app.post('/api/printer-settings', requireAuth, async (req, res) => {
  const { printerId, connected, type, sharedPath, ip, port } = req.body;
  if (!printerId) {
    return res.status(400).json({ error: 'Printer ID is required' });
  }
  try {
    await db.query(`
      INSERT INTO printer_settings (printer_id, connected, type, shared_path, ip, port)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (printer_id) DO UPDATE
      SET connected = EXCLUDED.connected,
          type = EXCLUDED.type,
          shared_path = EXCLUDED.shared_path,
          ip = EXCLUDED.ip,
          port = EXCLUDED.port
    `, [printerId, connected, type, sharedPath || '', ip || '', port ? parseInt(port) : null]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving printer settings:', error);
    res.status(500).json({ error: 'Failed to save printer settings' });
  }
});

// Endpoint to send raw print commands (Wifi, Windows Shared Spooler, or Direct System Printer)
app.post('/api/print-raw', requireAuth, async (req, res) => {
  const { printerType, ip, port, sharedPath, content } = req.body;

  // Cloud/Vercel environments cannot reach private local network IPs (e.g. 192.168.x.x)
  const isCloud = process.env.VERCEL || process.env.NODE_ENV === 'production' || (req.headers.host && !req.headers.host.includes('localhost') && !req.headers.host.includes('127.0.0.1') && !req.headers.host.includes('192.168.'));
  if (isCloud && printerType === 'wifi') {
    const isPrivateIP = ip && (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.'));
    if (isPrivateIP) {
      return res.status(400).json({ 
        error: `Kết nối đến máy in Wifi tại ${ip}:${port || 9100} bị quá hạn (Timeout). Máy chủ Cloud (Vercel) không thể kết nối trực tiếp đến IP mạng nội bộ Wifi của bạn. Bạn vẫn có thể lưu cài đặt này và in hóa đơn bình thường qua hộp thoại in của máy tính thu ngân.`
      });
    }
  }

  try {
    const result = await printRawOnServer(printerType, sharedPath, ip, port, content);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a print job (for Vercel polling fallback)
app.post('/api/print-jobs', requireAuth, async (req, res) => {
  const { printerId, type, payload } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO print_jobs (printer_id, type, payload) VALUES ($1, $2, $3) RETURNING *',
      [printerId, type, JSON.stringify(payload)]
    );
    res.status(201).json({ success: true, job: result.rows[0] });
  } catch (error) {
    console.error('Error creating print job:', error);
    res.status(500).json({ error: 'Lỗi khi tạo lệnh in.' });
  }
});

// Fetch pending print jobs
app.get('/api/print-jobs/pending', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM print_jobs WHERE status = 'pending' ORDER BY created_at ASC"
    );
    res.json({ success: true, jobs: result.rows });
  } catch (error) {
    console.error('Error fetching pending print jobs:', error);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách lệnh in.' });
  }
});

// Complete a print job
app.post('/api/print-jobs/:id/complete', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      "UPDATE print_jobs SET status = 'completed' WHERE id = $1",
      [id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing print job:', error);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái lệnh in.' });
  }
});

// Scan local network for TCP printers listening on Port 9100
app.get('/api/scan-printers', requireAuth, async (req, res) => {
  const os = require('os');
  const net = require('net');

  // Find local subnets, excluding virtual/VPN adapters
  function getLocalSubnets() {
    const interfaces = os.networkInterfaces();
    const subnets = [];
    for (const name of Object.keys(interfaces)) {
      const lowerName = name.toLowerCase();
      if (
        lowerName.includes('virtual') || 
        lowerName.includes('vbox') || 
        lowerName.includes('vmware') || 
        lowerName.includes('wsl') || 
        lowerName.includes('docker') || 
        lowerName.includes('loopback') ||
        lowerName.includes('vpn')
      ) {
        continue;
      }
      
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const parts = iface.address.split('.');
          if (parts.length === 4) {
            subnets.push(parts.slice(0, 3).join('.'));
          }
        }
      }
    }
    
    // Fallback if no subnets found after filtering virtual interfaces
    if (subnets.length === 0) {
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            const parts = iface.address.split('.');
            if (parts.length === 4) {
              subnets.push(parts.slice(0, 3).join('.'));
            }
          }
        }
      }
    }
    
    return [...new Set(subnets)];
  }

  // Probe single IP address on Port 9100 with a strict connection timeout
  function probePrinter(ip, port = 9100, timeout = 600) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const connTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({ ip, open: false });
        }
      }, timeout);

      socket.connect(port, ip, () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(connTimeout);
          socket.end();
          resolve({ ip, open: true });
        }
      });

      const handleFail = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(connTimeout);
          socket.destroy();
          resolve({ ip, open: false });
        }
      };

      socket.on('error', handleFail);
      socket.on('timeout', handleFail);
    });
  }

  try {
    let subnets = [];
    const querySubnet = req.query.subnet;
    if (querySubnet && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(querySubnet)) {
      subnets.push(querySubnet);
    } else {
      subnets = getLocalSubnets();
      // Fallback: If no subnets detected or we want to cover common subnets, add them
      const defaultSubnets = ['192.168.1', '192.168.0'];
      for (const def of defaultSubnets) {
        if (!subnets.includes(def)) {
          subnets.push(def);
        }
      }
    }

    if (subnets.length === 0) {
      return res.json({ success: true, printers: [] });
    }

    const discovered = [];
    
    // Scan detected subnets sequentially in chunks to prevent socket limits exhaustion
    for (const subnet of subnets) {
      const chunkSize = 32; // Probe in batches of 32
      for (let i = 1; i <= 254; i += chunkSize) {
        const chunk = [];
        for (let j = 0; j < chunkSize && (i + j) <= 254; j++) {
          const ip = `${subnet}.${i + j}`;
          chunk.push(probePrinter(ip, 9100, 600));
        }
        const results = await Promise.all(chunk);
        results.forEach(r => {
          if (r.open) {
            discovered.push({
              ip: r.ip,
              port: 9100,
              name: `Máy in LAN/Wifi (${r.ip})`
            });
          }
        });
      }
    }

    // Only fallback to simulated printers in local development/test environments
    const isLocalhost = req.headers.host && (
      req.headers.host.includes('localhost') || 
      req.headers.host.includes('127.0.0.1') || 
      req.headers.host.includes('192.168.')
    );
    
    if (discovered.length === 0 && isLocalhost) {
      discovered.push(
        { ip: '192.168.1.100', port: 9100, name: 'Xprinter XP-C300H (Quét giả lập)' },
        { ip: '192.168.1.250', port: 9100, name: 'Epson TM-T88VI (Quét giả lập)' }
      );
    }
      
    res.json({ success: true, printers: discovered });
  } catch (error) {
    console.error('Scan printers error:', error);
    res.status(500).json({ error: 'Lỗi khi quét mạng nội bộ.' });
  }
});

function wrapAndCenter(text, width = 42) {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
      while (currentLine.length > width) {
        lines.push(currentLine.substring(0, width));
        currentLine = currentLine.substring(width);
      }
    }
  });
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.map(line => {
    const pad = Math.floor((width - line.length) / 2);
    return pad > 0 ? ' '.repeat(pad) + line : line;
  }).join('\n');
}

function formatVNDShort(amount) {
  if (amount >= 1000) {
    return `${amount / 1000}K`;
  }
  return `${amount}đ`;
}

function padCenter(str, width) {
  if (str.length >= width) return str.substring(0, width);
  const padLeft = Math.floor((width - str.length) / 2);
  const padRight = width - str.length - padLeft;
  return ' '.repeat(padLeft) + str + ' '.repeat(padRight);
}

function padLeftRight(str, width) {
  if (str.length >= width) return str.substring(0, width);
  return str + ' '.repeat(width - str.length);
}

function wrapTextIntoChunks(text, maxWidth) {
  if (!text) return [''];
  const words = text.trim().split(/\s+/);
  const chunks = [];
  let currentChunk = '';
  
  words.forEach(word => {
    if ((currentChunk + (currentChunk ? ' ' : '') + word).length <= maxWidth) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
      while (currentChunk.length > maxWidth) {
        chunks.push(currentChunk.substring(0, maxWidth));
        currentChunk = currentChunk.substring(maxWidth);
      }
    }
  });
  if (currentChunk) chunks.push(currentChunk);
  return chunks.length > 0 ? chunks : [''];
}

function formatKitchenTable(items, width = 42) {
  const colQtyWidth = 6;
  const colNameWidth = width - colQtyWidth - 3;
  const border = '+' + '-'.repeat(colNameWidth) + '+' + '-'.repeat(colQtyWidth) + '+\n';
  
  let text = border;
  text += '|' + padCenter('Tên món', colNameWidth) + '|' + padCenter('SL', colQtyWidth) + '|\n';
  text += border;
  
  items.forEach(item => {
    const maxTextWidth = colNameWidth - 2;
    const nameChunks = wrapTextIntoChunks(item.name, maxTextWidth);
    
    const qtyStr = `x${item.quantity}`;
    text += '|' + padLeftRight(` ${nameChunks[0]}`, colNameWidth) + '|' + padCenter(qtyStr, colQtyWidth) + '|\n';
    
    for (let i = 1; i < nameChunks.length; i++) {
      text += '|' + padLeftRight(` ${nameChunks[i]}`, colNameWidth) + '|' + ' '.repeat(colQtyWidth) + '|\n';
    }
    
    if (item.notes) {
      const noteChunks = wrapTextIntoChunks(`*Ghi chú: ${item.notes}`, maxTextWidth);
      noteChunks.forEach(chunk => {
        text += '|' + padLeftRight(` ${chunk}`, colNameWidth) + '|' + ' '.repeat(colQtyWidth) + '|\n';
      });
    }
    text += border;
  });
  
  return text;
}

function formatReceiptTable(items, width = 42) {
  const colQtyWidth = width > 36 ? 5 : 4;
  const colPriceWidth = width > 36 ? 11 : 8;
  const colNameWidth = width - colQtyWidth - colPriceWidth - 4;
  const border = '+' + '-'.repeat(colNameWidth) + '+' + '-'.repeat(colQtyWidth) + '+' + '-'.repeat(colPriceWidth) + '+\n';
  
  let text = border;
  text += '|' + padCenter('Tên món', colNameWidth) + '|' + padCenter('SL', colQtyWidth) + '|' + padCenter('T.Tiền', colPriceWidth) + '|\n';
  text += border;
  
  items.forEach(item => {
    const maxTextWidth = colNameWidth - 2;
    const nameChunks = wrapTextIntoChunks(item.name, maxTextWidth);
    
    const qtyStr = `x${item.quantity}`;
    const priceStr = formatVNDShort(item.price * item.quantity);
    
    text += '|' + padLeftRight(` ${nameChunks[0]}`, colNameWidth) + '|' + padCenter(qtyStr, colQtyWidth) + '|' + padCenter(priceStr, colPriceWidth) + '|\n';
    
    for (let i = 1; i < nameChunks.length; i++) {
      text += '|' + padLeftRight(` ${nameChunks[i]}`, colNameWidth) + '|' + ' '.repeat(colQtyWidth) + '|' + ' '.repeat(colPriceWidth) + '|\n';
    }
    
    if (item.notes) {
      const noteChunks = wrapTextIntoChunks(`*Ghi chú: ${item.notes}`, maxTextWidth);
      noteChunks.forEach(chunk => {
        text += '|' + padLeftRight(` ${chunk}`, colNameWidth) + '|' + ' '.repeat(colQtyWidth) + '|' + ' '.repeat(colPriceWidth) + '|\n';
      });
    }
    text += border;
  });
  
  return text;
}

function formatPlainKitchenSlipServer(tableName, items, title) {
  const width = 42;
  const border = '-'.repeat(width) + '\n';
  const dateStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN');
  
  let text = '';
  text += wrapAndCenter('TAM XUA ORDER', width) + '\n';
  text += wrapAndCenter(title.toUpperCase(), width) + '\n';
  text += border;
  text += wrapAndCenter(`BÀN: ${tableName}`, width) + '\n';
  text += wrapAndCenter(`Giờ order: ${dateStr}`, width) + '\n';
  text += formatKitchenTable(items, width);
  
  text += '\n\n\n\n\n';
  return text;
}

function formatTimeServer(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const DD = pad(date.getDate());
  const MM = pad(date.getMonth() + 1);
  const YYYY = date.getFullYear();
  return `${hh}:${mm}:${ss} - ${DD}/${MM}/${YYYY}`;
}

function formatPlainReceiptServer(tableObj, orderItems, discountAmount, receivedAmount, timestamp, payMethod) {
  const width = 42;
  const border = '-'.repeat(width) + '\n';
  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const changeAmount = receivedAmount ? (receivedAmount - finalTotal) : 0;
  
  const orderTimeStr = (tableObj.updated_at || tableObj.updatedAt)
    ? formatTimeServer(tableObj.updated_at || tableObj.updatedAt).replace(' - ', ' ') 
    : (timestamp ? formatTimeServer(timestamp).replace(' - ', ' ') : formatTimeServer(new Date().toISOString()).replace(' - ', ' '));

  const checkoutTimeStr = timestamp 
    ? formatTimeServer(timestamp).replace(' - ', ' ') 
    : formatTimeServer(new Date().toISOString()).replace(' - ', ' ');

  const payMethodLabel = payMethod === 'bank' ? 'Chuyển khoản' : 'Tiền mặt';
  
  let text = '';
  text += wrapAndCenter('TẤM XƯA', width) + '\n';
  text += wrapAndCenter('Món Ngon Chuẩn Vị Bắc', width) + '\n';
  text += border;
  text += wrapAndCenter(`Bàn: ${tableObj.name}`, width) + '\n';
  text += wrapAndCenter(`Giờ vào: ${orderTimeStr}`, width) + '\n';
  text += wrapAndCenter(`Giờ ra: ${checkoutTimeStr}`, width) + '\n';
  text += formatReceiptTable(orderItems, width);
  
  text += wrapAndCenter(`Cộng món: ${formatVNDShort(subtotal)}`, width) + '\n';
  if (discountAmount > 0) {
    text += wrapAndCenter(`Giảm giá: -${formatVNDShort(discountAmount)}`, width) + '\n';
  }
  text += wrapAndCenter(`TỔNG CỘNG: ${formatVNDShort(finalTotal)}`, width) + '\n';
  text += wrapAndCenter(`Khách đưa: ${formatVNDShort(receivedAmount || finalTotal)}`, width) + '\n';
  if (changeAmount > 0) {
    text += wrapAndCenter(`Trả lại: ${formatVNDShort(changeAmount)}`, width) + '\n';
  }
  text += wrapAndCenter(`Thanh toán: ${payMethodLabel}`, width) + '\n';
  text += border;
  text += wrapAndCenter('Cảm ơn Quý khách!', width) + '\n';
  text += wrapAndCenter('Hẹn gặp lại quý khách!', width) + '\n';
  text += '\n\n\n\n\n';
  return text;
}

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

  // Handle printer routing requests from mobile phone clients to desktop cashier client
  socket.on('request_print_kitchen_slip', async (data) => {
    try {
      // Look up printer settings from database
      const printerRes = await db.query('SELECT * FROM printer_settings WHERE printer_id = $1', [data.printerId]);
      const printer = printerRes.rows[0];

      const isConnected = printer ? printer.connected : true;

      if (isConnected) {
        let type = printer ? printer.type : 'system';
        let sharedPath = printer ? printer.shared_path : '';
        
        // Force silent printing to default system printer if configured as browser
        if (type === 'browser') {
          type = 'system';
          sharedPath = '';
        }

        if (type === 'system') {
          const orderTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date().toLocaleDateString('vi-VN');
          const templateData = {
            table_name: data.tableName,
            order_time: orderTimeStr,
            items: data.items.map(item => ({
              name: item.name,
              quantity: item.quantity,
              notes: item.notes || ''
            }))
          };
          await printDocxOnServer(sharedPath, 'hoadonbep.docx', templateData);
        } else {
          const plainText = formatPlainKitchenSlipServer(data.tableName, data.items, data.title);
          await printRawOnServer(type, sharedPath, printer ? printer.ip : '', printer ? printer.port : null, plainText);
        }
        
        // Broadcast to all clients that server has printed it successfully
        io.emit('print_kitchen_slip', {
          ...data,
          printedByServer: true
        });
      } else {
        console.log(`Printer ${data.printerId} is disabled. Skipping print.`);
      }
    } catch (err) {
      console.error(`Error handling direct server print for ${data.printerId}:`, err);
      // Fallback: broadcast to client if printing on server failed
      socket.broadcast.emit('print_kitchen_slip', {
        ...data,
        printedByServer: false,
        error: err.message
      });
    }
  });

  socket.on('request_print_receipt', async (data) => {
    try {
      // Look up printer settings from database
      const printerRes = await db.query("SELECT * FROM printer_settings WHERE printer_id = 'receipt_default'");
      const printer = printerRes.rows[0];

      const isConnected = printer ? printer.connected : true;

      if (isConnected) {
        let type = printer ? printer.type : 'system';
        let sharedPath = printer ? printer.shared_path : '';
        
        if (type === 'browser') {
          type = 'system';
          sharedPath = '';
        }

        if (type === 'system') {
          const subtotal = data.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const finalTotal = Math.max(0, subtotal - data.discountAmount);
          const changeAmount = data.receivedAmount ? (data.receivedAmount - finalTotal) : 0;
          
          const orderTimeStr = data.tableObj.updatedAt 
            ? formatTimeServer(data.tableObj.updatedAt).replace(' - ', ' • ') 
            : (data.timestamp ? formatTimeServer(data.timestamp).replace(' - ', ' • ') : formatTimeServer(new Date().toISOString()).replace(' - ', ' • '));

          const checkoutTimeStr = data.timestamp 
            ? formatTimeServer(data.timestamp).replace(' - ', ' • ') 
            : formatTimeServer(new Date().toISOString()).replace(' - ', ' • ');

          const payMethodLabel = data.payMethod === 'bank' ? 'Chuyển khoản' : 'Tiền mặt';

          const templateData = {
            table_name: data.tableObj.name,
            order_time: orderTimeStr,
            checkout_time: checkoutTimeStr,
            subtotal: formatVNDShort(subtotal),
            discount: data.discountAmount > 0 ? `-${formatVNDShort(data.discountAmount)}` : '0đ',
            final_total: formatVNDShort(finalTotal),
            received_amount: formatVNDShort(data.receivedAmount || finalTotal),
            change_amount: formatVNDShort(Math.max(0, changeAmount)),
            payment_method: payMethodLabel,
            items: data.orderItems.map(item => ({
              emoji: item.emoji || '🍽️',
              name: item.name,
              price: formatVNDShort(item.price),
              quantity: item.quantity,
              total: formatVNDShort(item.price * item.quantity)
            }))
          };
          
          await printDocxOnServer(sharedPath, 'hoadon.docx', templateData);
        } else {
          const plainText = formatPlainReceiptServer(data.tableObj, data.orderItems, data.discountAmount, data.receivedAmount, data.timestamp, data.payMethod);
          await printRawOnServer(type, sharedPath, printer ? printer.ip : '', printer ? printer.port : null, plainText);
        }
        
        io.emit('print_receipt', {
          ...data,
          printedByServer: true
        });
      } else {
        console.log(`Receipt printer is disabled. Skipping print.`);
      }
    } catch (err) {
      console.error(`Error handling direct receipt print:`, err);
      socket.broadcast.emit('print_receipt', {
        ...data,
        printedByServer: false,
        error: err.message
      });
    }
  });

  socket.on('request_print_test', (data) => {
    socket.broadcast.emit('print_test', data);
  });
});

// System Update Endpoints (Git-based auto-update)
app.post('/api/system/check-update', async (req, res) => {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    // 1. Kiem tra xem co phai repo Git hay khong
    try {
      await execPromise('git rev-parse --is-inside-work-tree');
    } catch (gitErr) {
      return res.json({ hasUpdate: false, error: 'Thư mục ứng dụng không phải là một kho chứa Git (Git repository).' });
    }

    // 2. Fetch du lieu tu origin main
    await execPromise('git fetch origin main');

    // 3. Lay commit hash local va remote origin/main
    const localCommitRes = await execPromise('git rev-parse HEAD');
    const localCommit = localCommitRes.stdout.trim();

    const remoteCommitRes = await execPromise('git rev-parse origin/main');
    const remoteCommit = remoteCommitRes.stdout.trim();

    if (localCommit === remoteCommit) {
      return res.json({ hasUpdate: false, branch: 'main', localCommit });
    }

    // 4. Lay danh sach commit moi
    const logRes = await execPromise(`git log HEAD..origin/main --oneline`);
    const commits = logRes.stdout.trim().split('\n').filter(c => c);

    return res.json({
      hasUpdate: true,
      branch: 'main',
      localCommit,
      remoteCommit,
      commits
    });

  } catch (err) {
    console.error('Loi kiem tra cap nhat:', err);
    return res.status(500).json({ hasUpdate: false, error: err.message });
  }
});

app.get('/api/system/apply-update', (req, res) => {
  const { exec, spawn } = require('child_process');
  const path = require('path');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendProgress = (step, percent, message) => {
    res.write(`data: ${JSON.stringify({ step, percent, message })}\n\n`);
  };

  sendProgress('START', 10, 'Bắt đầu quá trình cập nhật...');
  sendProgress('GIT_PULL_START', 20, 'Đang kéo mã nguồn mới nhất từ Git (git pull origin main)...');
  
  exec('git pull origin main', async (pullErr, stdout, stderr) => {
    if (pullErr) {
      sendProgress('ERROR', 0, `Lỗi khi chạy git pull: ${pullErr.message}\n${stderr}`);
      return res.end();
    }

    sendProgress('GIT_PULL_SUCCESS', 45, `Tải code mới thành công:\n${stdout}`);

    // Kiem tra package.json co thay doi hay khong
    let needsNpmInstall = false;
    try {
      const { execSync } = require('child_process');
      const diffOutput = execSync('git diff --name-only HEAD@{1} HEAD').toString();
      if (diffOutput.includes('package.json')) {
        needsNpmInstall = true;
      }
    } catch (diffErr) {
      needsNpmInstall = true; // Fallback
    }

    if (needsNpmInstall) {
      sendProgress('NPM_INSTALL_START', 50, 'Phát hiện thay đổi thư viện. Đang cài đặt thư viện mới (npm install)...');
      exec('npm install', (npmErr, npmStdout, npmStderr) => {
        if (npmErr) {
          sendProgress('ERROR', 0, `Lỗi khi cài đặt thư viện: ${npmErr.message}\n${npmStderr}`);
          return res.end();
        }
        sendProgress('NPM_INSTALL_SUCCESS', 80, `Cập nhật thư viện thành công:\n${npmStdout}`);
        proceedToRestart();
      });
    } else {
      sendProgress('NPM_INSTALL_SKIP', 80, 'Không có thay đổi trong thư viện. Bỏ qua cài đặt.');
      proceedToRestart();
    }
  });

  function proceedToRestart() {
    sendProgress('MIGRATING', 85, 'Đang kiểm tra và cập nhật cấu trúc cơ sở dữ liệu...');
    db.setupDatabase()
      .then(() => {
        sendProgress('RESTARTING', 95, 'Cấu trúc cơ sở dữ liệu đã được cập nhật. Đang chuẩn bị khởi động lại máy chủ...');
        sendProgress('DONE', 100, 'Cập nhật thành công! Hệ thống sẽ khởi động lại trong 3 giây. Vui lòng tải lại trang sau đó.');
        res.end();

        setTimeout(() => {
          console.log('Tien hanh khoi dong lai server...');
          server.close();
          io.close();

          setTimeout(() => {
            const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
              cwd: __dirname,
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
            process.exit(0);
          }, 1000);
        }, 3000);
      })
      .catch((dbErr) => {
        sendProgress('ERROR', 0, `Lỗi khi cập nhật cấu trúc dữ liệu: ${dbErr.message}`);
        res.end();
      });
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
