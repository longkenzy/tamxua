const db = require('./db');

async function seedData() {
  console.log('--- Bắt đầu tạo dữ liệu mẫu ---');
  
  try {
    // 1. Đảm bảo cấu trúc cơ sở dữ liệu đã được cài đặt và nạp các bàn ăn/món ăn mặc định
    console.log('Đang kiểm tra và khởi tạo database schema nếu cần...');
    await db.setupDatabase();
    
    // 2. Lấy danh sách món ăn từ thực đơn (menu) và danh sách bàn (tables)
    const menuRes = await db.query('SELECT * FROM menu');
    const menuItems = menuRes.rows;
    if (menuItems.length === 0) {
      console.error('Lỗi: Không tìm thấy món ăn nào trong thực đơn. Vui lòng kiểm tra lại db.js.');
      process.exit(1);
    }
    console.log(`Đã tìm thấy ${menuItems.length} món ăn trong thực đơn.`);

    const tablesRes = await db.query('SELECT * FROM tables');
    const tables = tablesRes.rows;
    if (tables.length === 0) {
      console.error('Lỗi: Không tìm thấy bàn ăn nào. Vui lòng kiểm tra lại db.js.');
      process.exit(1);
    }
    console.log(`Đã tìm thấy ${tables.length} bàn ăn.`);

    // 3. Xóa dữ liệu hóa đơn cũ để chuẩn bị sinh dữ liệu mới sạch sẽ
    console.log('Đang dọn dẹp hóa đơn cũ (transactions & transaction_items)...');
    await db.query('DELETE FROM transaction_items');
    await db.query('DELETE FROM transactions');
    console.log('Đã dọn dẹp xong.');

    // 4. Bắt đầu sinh dữ liệu hóa đơn cho 30 ngày qua
    const client = await db.pool.connect();
    
    let totalTransactions = 0;
    let totalRevenue = 0;

    try {
      await client.query('BEGIN');
      
      const today = new Date();
      
      for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() - dayOffset);
        
        // Xác định ngày trong tuần (0: Chủ Nhật, 6: Thứ Bảy)
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        
        // Cuối tuần đông khách hơn ngày thường
        const numTransactions = isWeekend 
          ? Math.floor(Math.random() * 16) + 25 // 25 - 40 đơn/ngày
          : Math.floor(Math.random() * 11) + 15; // 15 - 25 đơn/ngày

        console.log(`Ngày ${currentDate.toLocaleDateString('vi-VN')}: tạo ${numTransactions} hóa đơn...`);
        
        for (let i = 0; i < numTransactions; i++) {
          // Xác định khung giờ ngẫu nhiên (sáng/trưa/tối)
          // 20% sáng (7:00 - 9:30)
          // 45% trưa (11:00 - 13:30)
          // 30% tối (18:00 - 20:30)
          // 5% các giờ khác
          const rand = Math.random();
          let hour = 12;
          let minute = Math.floor(Math.random() * 60);
          
          if (rand < 0.20) {
            hour = Math.floor(Math.random() * 3) + 7; // 7, 8, 9
          } else if (rand < 0.65) {
            hour = Math.floor(Math.random() * 3) + 11; // 11, 12, 13
          } else if (rand < 0.95) {
            hour = Math.floor(Math.random() * 3) + 18; // 18, 19, 20
          } else {
            hour = Math.floor(Math.random() * 15) + 6; // 6 - 21
          }

          const txDate = new Date(currentDate);
          txDate.setHours(hour, minute, Math.floor(Math.random() * 60), Math.floor(Math.random() * 1000));
          
          // ID hóa đơn
          const txId = `TX-${txDate.getTime()}-${Math.floor(Math.random() * 1000)}`;

          // Chọn ngẫu nhiên bàn
          const table = tables[Math.floor(Math.random() * tables.length)];

          // Chọn ngẫu nhiên từ 1 đến 5 món ăn không trùng lặp
          const numItems = Math.floor(Math.random() * 5) + 1;
          const selectedItems = [];
          const tempMenu = [...menuItems];
          for (let k = 0; k < numItems; k++) {
            if (tempMenu.length === 0) break;
            const idx = Math.floor(Math.random() * tempMenu.length);
            selectedItems.push(tempMenu.splice(idx, 1)[0]);
          }

          // Tính tổng tiền món ăn
          let subtotal = 0;
          const itemsToInsert = [];
          
          for (const menuItem of selectedItems) {
            const quantity = Math.floor(Math.random() * 3) + 1; // 1 - 3 phần
            const notes = Math.random() < 0.15 ? 'ít hành, không cay' : ''; // 15% có ghi chú
            subtotal += menuItem.price * quantity;
            
            const options = [];
            const lowerName = menuItem.name.toLowerCase();
            if (lowerName.includes('cơm nhà') || lowerName.includes('cơm')) {
              if (Math.random() < 0.5) {
                options.push({ id: 13, name: 'Cá', price: 0, group_name: 'Món mặn', group_id: 3 });
              } else {
                options.push({ id: 14, name: 'Thịt', price: 0, group_name: 'Món mặn', group_id: 3 });
              }
            }
            if (lowerName.includes('cơm tấm')) {
              options.push({ id: 5, name: 'Trứng', price: 0, group_name: 'Món phụ', group_id: 1 });
              options.push({ id: 6, name: 'Bì', price: 0, group_name: 'Món phụ', group_id: 1 });
            }

            itemsToInsert.push({
              name: menuItem.name,
              emoji: menuItem.emoji,
              price: menuItem.price,
              quantity,
              notes,
              options
            });
          }

          // Giảm giá ngẫu nhiên (10% hóa đơn được giảm giá)
          let discount = 0;
          if (Math.random() < 0.10) {
            // Giảm giá cố định từ 10k đến 50k (bội số của 5000)
            const availableDiscounts = [10000, 15000, 20000, 30000, 50000];
            discount = availableDiscounts[Math.floor(Math.random() * availableDiscounts.length)];
            // Không được giảm giá vượt quá tổng tiền
            if (discount >= subtotal) {
              discount = 0;
            }
          }

          const finalTotal = subtotal - discount;

          // Phương thức thanh toán: 60% cash, 40% bank
          const paymentMethod = Math.random() < 0.60 ? 'cash' : 'bank';
          
          let receivedAmount = finalTotal;
          let changeAmount = 0;

          if (paymentMethod === 'cash') {
            // Khách đưa tiền mặt thường làm tròn (100k, 200k, 500k,...)
            if (finalTotal <= 50000) {
              receivedAmount = 50000;
            } else if (finalTotal <= 100000) {
              receivedAmount = Math.random() < 0.5 ? 100000 : finalTotal;
            } else if (finalTotal <= 200000) {
              receivedAmount = Math.random() < 0.5 ? 200000 : 500000;
            } else {
              receivedAmount = Math.ceil(finalTotal / 100000) * 100000;
            }
            // Đảm bảo received_amount lớn hơn hoặc bằng finalTotal
            if (receivedAmount < finalTotal) {
              receivedAmount = finalTotal;
            }
            changeAmount = receivedAmount - finalTotal;
          } else {
            // Chuyển khoản thanh toán chính xác 100%
            receivedAmount = finalTotal;
            changeAmount = 0;
          }

          let txBankName = null;
          let txAccountNumber = null;
          let txAccountHolder = null;
          if (paymentMethod === 'bank') {
            txBankName = 'MB BANK';
            txAccountNumber = '25103456789';
            txAccountHolder = 'HUYNH THANH LONG';
          }

          // Insert Transaction
          await client.query(`
            INSERT INTO transactions (id, table_id, table_name, subtotal, received_amount, change_amount, discount_amount, payment_method, bank_name, account_number, account_holder, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [txId, table.id, table.name, subtotal, receivedAmount, changeAmount, discount, paymentMethod, txBankName, txAccountNumber, txAccountHolder, txDate]);

          // Insert Transaction Items
          for (const item of itemsToInsert) {
            await client.query(`
              INSERT INTO transaction_items (transaction_id, name, emoji, price, quantity, notes, options)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [txId, item.name, item.emoji, item.price, item.quantity, item.notes, JSON.stringify(item.options || [])]);
          }

          totalTransactions++;
          totalRevenue += finalTotal;
        }
      }

      await client.query('COMMIT');
      
      console.log('\n--- KẾT QUẢ TẠO DỮ LIỆU ---');
      console.log(`- Tổng số hóa đơn đã sinh: ${totalTransactions}`);
      console.log(`- Tổng doanh thu giả lập: ${totalRevenue.toLocaleString('vi-VN')}đ`);
      console.log('--- Hoàn tất thành công! ---');
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Lỗi khi tạo dữ liệu mẫu:', error);
  } finally {
    // Ngắt kết nối với pool để script dừng hoàn toàn
    db.pool.end();
  }
}

seedData();
