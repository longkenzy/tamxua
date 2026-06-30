# 🍜 Tam Xưa Order

Ứng dụng web gọi món ăn thời gian thực (Real-time Restaurant Ordering System) được thiết kế theo phong cách giao diện Airbnb sang trọng và trực quan.

## 🚀 Các Tính Năng Chính
* **Gọi món thời gian thực (Real-time Order):** Nhân viên phục vụ gửi order từ điện thoại/iPad, màn hình quản lý cập nhật lập tức qua Socket.io.
* **Quản lý sơ đồ bàn ăn:** Theo dõi trạng thái bàn trống/đang dùng, thời gian khách ngồi ăn trực quan.
* **Tính tiền thông minh:** Hỗ trợ tính năng giảm giá theo % hoặc tiền mặt, máy tính tiền thối lại cho khách.
* **In hóa đơn trực tiếp:** Tích hợp tính năng xuất và in hóa đơn tự động định dạng chuẩn máy in nhiệt K80 từ mẫu file Word `.docx` thông qua chuyển đổi HTML.
* **Báo cáo & Phân tích:** Trực quan hóa doanh thu theo ngày, biểu đồ cột so sánh, biểu đồ phân phối doanh thu theo khung giờ cao điểm và tỷ lệ các món ăn bán chạy nhất.

## 🛠️ Công Nghệ Sử Dụng
* **Backend:** Node.js, Express, Socket.io, Multer, pg (PostgreSQL), Docxtemplater, Mammoth
* **Frontend:** HTML5, CSS3 (Airbnb Design System), JavaScript (ES6), Chart.js
* **Database:** Neon Postgres (Cloud Database)

## 📦 Hướng dẫn cài đặt
1. Cài đặt các package phụ thuộc:
   ```bash
   npm install
   ```
2. Cấu hình biến môi trường `DATABASE_URL` trong file `.env` hoặc cấu hình hệ thống:
   ```env
   DATABASE_URL=your_postgresql_connection_string
   ```
3. Chạy ứng dụng:
   ```bash
   npm start
   ```
