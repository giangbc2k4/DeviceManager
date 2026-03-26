# HƯỚNG DẪN CẬP NHẬT PHẦN MỀM TỪ XA (OTA UPDATE)

Tài liệu này hướng dẫn cách phát hành một bản cập nhật Firmware mới cho toàn bộ các thiết bị ESP32 IoT đang hoạt động ở các phòng mà **KHÔNG CẦN CHẠM TỚI THIẾT BỊ**.

## 1. Cơ chế hoạt động của ESP32 (Auto-Update)
Mạch ESP32 đã được lập trình để tự động kiểm tra phiên bản trên mạng *mỗi khi cắm điện khởi động lại*. Cơ chế gồm:
1. ESP32 đang chạy phiên bản cũ (Ví dụ: `2.0.0`).
2. Mạch tải file cấu hình `version.json` từ GitHub.
3. Nếu phát hiện version trên GitHub lớn hơn (Ví dụ: `2.0.1`), mạch sẽ tự động tải file ảnh `.bin` về nạp đè lên bộ nhớ.
4. Mạch tự khởi động lại và báo cáo "Phiên bản mới" lên Dashboard.

## 2. Quy trình phát hành bản cập nhật (Dành cho Kỹ thuật viên)

### Bước 2.1: Biên dịch Firmware mới (.bin)
1. Mở phần mềm **Arduino IDE**.
2. Mở file mã nguồn `Blink.ino` mới nhất mà bạn vừa chỉnh sửa xong.
3. Tìm dòng chữ `#define FW_VERSION "2.0.0"` và nâng lên phiên bản tiếp theo, ví dụ: `#define FW_VERSION "2.0.1"`.
4. Trên thanh Menu của Arduino IDE, ấn: `Sketch` -> `Export Compiled Binary`.
5. Sau khi quá trình kết thúc, ở cùng thư mục chứa file `Blink.ino`, bạn sẽ thấy một file tên là `Blink.ino.esp32.bin` (hoặc tương tự).
6. Đổi tên file đó thành một tên dễ nhớ gọn gàng, ví dụ: `firmware_v2.0.1.bin`.

### Bước 2.2: Tải file lên Dashboard (Web Mạng)
1. Mở trang quản trị của bạn, chọn mục **OTA Firmware** ở trên cột menu.
2. Tại phần **Upload & Release Firmware**, điền số phiên bản mới vào ô Phiên bản (ví dụ: `2.0.1`). Phải cao hơn số cũ.
3. Bấm vào nút **Chọn File** và trỏ đường dẫn tới file `firmware_v2.0.1.bin` mà bạn vừa xuất ra.
4. Ghi chú một chút ở phần Release note (ví dụ: "Cập nhật Fix lỗi rớt mạng").
5. Nhấn nút màu xanh **Upload & Release**.
6. Hệ thống Dashboard sẽ tự động liên kết với máy chủ đám mây, mã hoá file, đẩy thẳng lên Github và nâng version chỉ trong 5-10 giây.
7. Đợi thanh tiến trình báo màu xanh báo thành công. Mọi thứ ĐÃ XONG! Mạch sẽ tự nạp fw mới.

---

## 3. Cách ép thiết bị cập nhật (Dành cho Cửa hàng trưởng)
Vì mạch chỉ kiểm tra OTA lúc "Khởi động", nếu mạch đang cắm điện chạy liên tục, nó sẽ không biết có bản cập nhật mới. Bạn cần:

**Cách 1:** Rút điện mạch và cắm lại. (Mạch sẽ up OTA ngay).
**Cách 2:** Lên trang Quản lý Thiết bị (Dashboard) -> Tắt và Mở Khoá Thiết Bị hoặc Nhấn Reboot -> Mạch sẽ rơi vào trạng thái bắt buộc khởi động lại qua giám sát Watchdog hoặc lệnh khoá -> Sau khi khởi động nó sẽ tự lên phiên bản mới.

## 4. Xác nhận thành công
Vào Dashboard quản lý. Ở các bảng thiết bị hoặc danh sách Phiên hoạt động, bạn sẽ thấy thiết bị đổi từ `v2.0.0` sang `v2.0.1` kèm màu xanh lá rực rỡ báo hiệu quá trình nạp dữ liệu hoàn tất.
