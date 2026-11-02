# Cửa Phật Online — bản khởi đầu

## Có gì trong bản này
- Giao diện tiếng Việt, ưu tiên điện thoại.
- Nghi thức mô phỏng: thắp nhang, dâng hoa, dâng lễ, tĩnh tâm.
- Form cúng dường tùy tâm, tùy chọn ẩn danh.
- API lưu yêu cầu vào PostgreSQL.
- Thống kê lượt tham dự gần đây và các khoản đã được webhook xác nhận.
- API quản trị có token.

## Chạy thử
Yêu cầu Node.js 20+ và PostgreSQL.

1. Tạo database PostgreSQL, chạy `schema.sql`.
2. Sao chép `.env.example` thành `.env`, điền `DATABASE_URL` và `ADMIN_TOKEN`.
3. Chạy:
   ```bash
   npm install
   npm start
   ```
4. Mở `http://localhost:3000`.

## Rất quan trọng trước khi nhận tiền thật
Bản này **chưa tích hợp thanh toán thật**. Không coi ảnh chụp chuyển khoản hay lời người gửi là xác nhận thanh toán.
- Chỉ dùng tài khoản do đúng pháp nhân/chùa hoặc người được ủy quyền hợp lệ đứng tên.
- Công khai chủ thể tiếp nhận, mục đích, cách quản lý và báo cáo sử dụng tiền.
- Chọn ngân hàng/cổng thanh toán hoặc nhà cung cấp đối soát có webhook chính thức.
- Hoàn thiện xác minh chữ ký webhook theo tài liệu chính thức của nhà cung cấp. Mã webhook hiện tại là khung minh họa HMAC, không phải tích hợp sẵn với ngân hàng nào.
- Không đưa mật khẩu ngân hàng, khóa bí mật hoặc ADMIN_TOKEN vào frontend.
- Cần HTTPS, sao lưu, giám sát, kiểm thử tải và rà soát bảo mật trước khi mở công khai.

## Mục tiêu 1.000 người
Đây là bộ khung để triển khai, **không phải cam kết đã kiểm thử chịu tải 1.000 người đồng thời**. Khi triển khai thực tế:
- Dùng PostgreSQL được quản lý, connection pooling, giới hạn truy vấn.
- Chạy nhiều instance Node sau load balancer; phục vụ ảnh qua CDN/object storage.
- Thêm Redis/rate-limit phân tán, logging, monitoring, backup và chống bot.
- Kiểm thử tải ở mức 1.000 kết nối đồng thời trên môi trường staging.
- Thống kê hiện tại là lượt tham dự duy nhất gần đúng theo phiên trong 30 phút, không phải số người đang online chính xác.
