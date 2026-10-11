# DT Zalo — Trợ lý tại quầy

Ứng dụng desktop với bong bóng luôn nổi và popup CRM nhập mua hàng/cấp lượt
Mini Game riêng. Dùng CRM đang triển khai tại https://dtzalobe.io.vn/desktop-assistant.
Renderer từ CRM không có Node hoặc native bridge; chỉ bong bóng local có thể mở popup.

```powershell
npm.cmd ci
node node_modules/electron/install.js
npm.cmd test
npm.cmd run build
```

Bộ cài Windows ở `../output/desktop-assistant/DT-Zalo-Counter-Setup-1.0.1.exe`, chưa ký số.
Phiên bản 1.0.1 thêm cấu hình macOS Intel/Apple Silicon và Linux x64/ARM64.
Xem [CROSS_PLATFORM.md](CROSS_PLATFORM.md) để tạo DMG, AppImage, deb bằng GitHub Actions
hoặc máy tương ứng. Chưa có bộ cài Mac/Linux được build và chạy thử trong lần sửa này.
Không tự bật startup; người dùng chọn trong menu chuột phải/khay hệ thống.
Bấm bong bóng mở popup, kéo viền di chuyển, đóng popup để ẩn, menu Thoát để dừng app.
Always-on-top áp dụng cho cửa sổ thông thường, không vượt màn hình khóa/UAC Windows.
macOS hỗ trợ các Spaces/full screen; Linux ưu tiên X11/XWayland để giữ vị trí cửa sổ nổi.

App chỉ hoạt động đủ luồng khi đã cập nhật BE/migration `a6d8e0f2b417`, CRM và phát
hành Mini App có phiếu riêng. Quyền/game/tổng tiền/lượt/SĐT được backend xác minh.
Hướng dẫn chi tiết và lệnh VPS: `../deployment/DESKTOP_PURCHASE_GAME.md`.

Dev:

```powershell
$env:DTCRM_URL = 'http://127.0.0.1:5192'
npm.cmd start
```

HTTP chỉ cho phép localhost ở bản dev; bản đóng gói cần HTTPS. Không đặt token
trong URL. Khi chạy từ môi trường có `ELECTRON_RUN_AS_NODE=1`, bỏ biến này cho
process Electron để ứng dụng chạy GUI bình thường.

Native smoke dùng dữ liệu giả: chạy frontend Vite trên localhost:5192 trước,
sau đó `node tests/smoke-ui.mjs`. Script chặn mọi API CRM để không viết vào hệ thống
thật, chụp popup/QR và lưu báo cáo ở `../output/desktop-assistant/review`.
