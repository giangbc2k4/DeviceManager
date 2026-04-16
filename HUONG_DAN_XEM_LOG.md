# HƯỚNG DẪN XEM LOG & CHẨN ĐOÁN LỖI THIẾT BỊ

Hệ thống quản lý được trang bị một bộ công cụ giám sát từ xa (Terminal Real-time) kết hợp cùng hệ thống phân tích nguyên nhân sự cố thông minh. Tài liệu này hướng dẫn cách kiểm tra lỗi khi có thiết bị bị than phiền "chết mạch / sập nguồn / mất mạng".

---

## 1. Cách truy cập vào màn hình Realtime Console

### Bước 1: Kích hoạt nút "Bật Debug"
Mặc định để tiết kiệm bộ nhớ RAM và không làm nóng mạch, thiết bị ESP32 không gửi Log.
- Vào Dashboard, trang **Thiết bị**. Tìm thiết bị bạn muốn theo dõi.
- Ở cột "Debug", gạt công tắc từ bóng xám sang **Xanh dương** (Trạng thái ON).
- Server sẽ báo lệnh này cho thiết bị ở nhịp tim (Heartbeat) tiếp theo. *Bạn có thể chờ tự nhiên tối đa khoảng 60 giây, hoặc nhanh tay rút/cắm điện thiết bị để ép nó đọc lệnh Debug ngay lập tức.*

### Bước 2: Hiển thị Log theo thời gian thực (Terminal)
- Bên cạnh nút Khóa/Mở Khóa, có biểu tượng hình **Cửa sổ lệnh (Terminal \_\_ )**.
- Bấm vào đó, một cửa sổ đen với dòng chữ xanh lá cây sẽ hiện ra nối thẳng trực tiếp tới não bộ của ESP32.
- Bất cứ sự thay đổi nào (Mạng rớt, Mất điện, Có thao tác HTML, Heartbeat check) đều được thiết bị gửi lên màn hình y như Console.

---

## 2. Sổ Tay Chẩn Đoán (Đọc bệnh mạch điện)

Bên phải màn hình đen là "Từ Điển Chẩn Đoán". Thấy chữ màu nào, áp dụng bệnh màu đó:

### 🔴 Lỗi Chết Nguồn hoặc Bị Treo (Màu Đỏ)
Nếu bạn thấy dòng chữ thông báo ghi là: **HW_REASON: Brownout**  
👉 **Nguyên nhân:** Dòng điện nuôi mạch đột ngột bị tuột áp. Có nghĩa là nguồn mạch sạc điện thoại đang cắm bị lỗi, dởm, hoặc dây điện quá mỏng làm suy kệt mạch khi mạch dùng WiFi cường độ cao.  
👉 **Cách xử lý:** Đổi dây sạc, cốc sạc 5V-2A chuẩn cho mạch điện đó.

Nếu hiện: **HW_REASON: Panic / WDT (Watchdog)**
👉 **Nguyên nhân:** Khả năng cao do Code dội bộ nhớ, vòng lặp kẹt cứng. Watchdog bảo vệ đã kích hoạt "giết" con chip để tự khởi động lại.  
👉 **Cách xử lý:** Báo kỹ thuật kiểm tra lại mã nguồn (đang rò rỉ bộ nhớ).

### 🔴 Lỗi Mạng WiFi Tệ (Màu Đỏ)
Nếu hiện: **CRIT: API_ERR_RESTART**  
👉 **Nguyên nhân:** Rớt mạng WiFi, hoặc Google Server không trả lời sau 5 lần cố gắng. Mạch đã tự chủ động reset WiFi để khôi phục trạm sóng.  
👉 **Cách xử lý:** Đợi thiết bị phục hồi (Auto), hoặc kiểm tra router cục phát WiFi gần đó.

### 🟠 Bộ Nhớ Bị Tràn Dịch (Màu Cam)
Nếu hiện: **WARN: Low Heap (< 40000 B free)**
👉 **Nguyên nhân:** Lời phàn nàn của vi mạch báo rằng RAM đang cạn kiệt.
👉 **Cách xử lý:** Theo dõi thêm. Nếu tiếp tục cạn, mạch sẽ kích hoạt Panic phục hồi tự động (về báo động HW_REASON đỏ). 

### 🟢 Hoàn Hảo Bình Thường (Màu Xanh Lá)
Nếu hiện: **INFO: Heartbeat OK | Heap: ... | Uptime: ...**
👉 **Nguyên nhân:** Mọi thứ đều đang làm việc tốt nhất. Thiết bị nhịp tim cực kỳ khoẻ mạnh, Google báo khớp thẻ từ liên giao mạng thành công.

---

## 3. Tắt Debug (Rất Quan Trọng!)
Sau khi xem bệnh xong, **BẠN PHẢI TẮT LẠI NÚT DEBUG Ở BẢNG ĐIỀU KHIỂN**.
- Vì Log được gửi bằng sóng WiFi lên Internet qua Firebase. 
- Việc bật Debug mãi mãi sẽ làm tốn hàng triệu tín hiệu/ngày vào băng thông Internet, làm thiết bị xử lý nặng tay, chậm hơn và rất dễ kẹt RAM dẫn đến tính trạng tự Restart nhiều hơn mức bình thường.
