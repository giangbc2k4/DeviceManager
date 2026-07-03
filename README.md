# DeviceManager

Dashboard quản trị thiết bị đăng ký, nhật ký hoạt động, báo cáo và firmware OTA. Ứng dụng dùng Next.js API Routes với Google Sheets làm nguồn dữ liệu chính.

## Tính năng

- Đăng nhập quản trị và quản lý phiên.
- Quản lý danh sách thiết bị đăng ký.
- Nhật ký hoạt động và báo cáo thiết bị.
- API cấp phép, bật/tắt, hết hạn và xóa thiết bị.
- Upload, kích hoạt và xóa firmware OTA.
- Tích hợp Google Sheets cho thiết bị và hoạt động.
- Trang báo cáo theo chat/user ID.

## Công nghệ

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Google APIs

## Cấu trúc dự án

```text
app/admin/            Admin dashboard pages and widgets
app/api/              Device, firmware, login, logout, and OTA API routes
app/report/           Public/report views
lib/auth.ts           Admin authentication helpers
lib/google-sheets.ts  Google Sheets integration
lib/ota-github.ts     OTA/GitHub helper logic
```

## Cài đặt và chạy

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

## Biến môi trường

Sao chép `.env.example` thành `.env.local` và điền:

```env
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
GOOGLE_SHEETS_DEVICE_SHEET=MAC_REGISTRY
GOOGLE_SHEETS_ACTIVITY_SHEET=Sheet1
GOOGLE_SHEETS_TZ_OFFSET_MINUTES=420
```

`GOOGLE_SHEETS_PRIVATE_KEY` nên được lưu trên một dòng với ký tự `\n`.

## Lệnh npm

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Bản triển khai

**Website:** https://device-manager-three.vercel.app

Ứng dụng được triển khai bằng preset Next.js trên Vercel. Cần thêm đầy đủ biến môi trường vào Vercel trước khi build; bản deploy chỉ hoạt động đúng khi Google service account, Google Sheets và thông tin đăng nhập admin đã được cấu hình.

## Kiến trúc và luồng dữ liệu

Dashboard dùng Next.js App Router. `lib/google-sheets.ts` đọc/ghi registry và activity sheet qua service account. Các route trong `app/api/devices` thực hiện license, bật/tắt, hết hạn, xóa và log. Nhóm `app/api/ota`/`firmware` phối hợp `lib/ota-github.ts` để upload, kích hoạt hoặc xóa firmware. Cookie/session admin được xử lý tại `lib/auth.ts`.

```text
Admin UI -> Next.js API -> Google Sheets
                  \-> GitHub/OTA repository -> ESP32 devices
Public report -> report/[chatId] -> activity data
```

## Chuẩn bị Google Sheets

1. Tạo Google Cloud service account và bật Google Sheets API.
2. Chia sẻ spreadsheet cho email service account với quyền cần thiết.
3. Tạo sheet registry (mặc định `MAC_REGISTRY`) và activity (mặc định `Sheet1`).
4. Đặt spreadsheet ID, client email và private key trong `.env.local`.
5. Giữ `\n` trong private key dạng một dòng khi cấu hình Vercel.

Tên và thứ tự cột phải khớp cách `lib/google-sheets.ts` đọc dữ liệu; hãy kiểm tra file này trước khi đổi sheet.

## Quản lý OTA

Đọc `HUONG_DAN_OTA.md` trước khi phát hành. Luồng an toàn là upload binary versioned, lưu checksum, thử trên nhóm staging, sau đó mới activate. Không ghi đè binary của version cũ; luôn giữ một bản rollback. Tài khoản/token GitHub dùng cho OTA chỉ nên có quyền trên repository firmware.

## Bảo mật

- Đổi `ADMIN_PASSWORD` mạnh và tạo `ADMIN_SESSION_SECRET` ngẫu nhiên dài.
- Không để route debug hoạt động công khai trong production.
- Bảo vệ toàn bộ route thay đổi thiết bị/firmware bằng session và CSRF.
- Rate-limit login, log thao tác admin và không trả private key trong response.
- Trang report theo `chatId` cần được xem xét vì ID đoán được không phải cơ chế phân quyền.

## Vận hành

Chạy `npm run lint` và `npm run build` trước deploy. Khi lỗi dữ liệu, xem `HUONG_DAN_XEM_LOG.md`, log Vercel và quyền chia sẻ Sheet. Google Sheets có quota và không đảm bảo transaction như database; nếu số thiết bị tăng, nên chuyển registry/log sang database và dùng Sheets chỉ cho báo cáo.
