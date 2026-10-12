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

Bộ cài Windows hiện tại ở `../output/desktop-assistant/DT-Zalo-Counter-Setup-1.0.5.exe`, chưa ký số.
Phiên bản 1.0.5 dùng cập nhật thủ công: tải bộ cài mới từ GitHub Actions rồi cài đè.
Xem [AUTO_UPDATE.md](AUTO_UPDATE.md) để chọn bộ cài cho Windows/macOS/Linux và phát hành bản mới.
Không có kiểm tra/tải bản mới trong app hoặc bundle cập nhật cần đưa lên VPS.
Phiên bản 1.0.3 thu cửa sổ mặc định từ 600×850 xuống 480×680. Hai form desktop
thu nhỏ 20% và phần đăng nhập bỏ lời chào, mô tả, liên hệ quản trị. Cần cập nhật
frontend trên VPS để nhận thay đổi nội dung/form; cài lại app để nhận kích thước cửa sổ mới.
Phiên bản 1.0.2 cho phép giữ và kéo trên toàn bộ bong bóng, lưu vị trí sau khi thả;
kéo không mở popup, bấm hoặc Enter/Space vẫn mở popup như trước.
CRM cần cập nhật frontend để nhận form gọn hơn và danh sách sản phẩm phân trang đầy đủ.
Phiên bản 1.0.1 thêm cấu hình macOS Intel/Apple Silicon và Linux x64/ARM64.
Xem [CROSS_PLATFORM.md](CROSS_PLATFORM.md) để tạo DMG, AppImage, deb bằng GitHub Actions
hoặc máy tương ứng. Repo riêng: https://github.com/vxphuc/dt-zalo-counter-desktop (Private).
Đã build và lưu bộ cài thành công cho cả 5 OS/kiến trúc ngày 11/10/2026:
https://github.com/vxphuc/dt-zalo-counter-desktop/actions/runs/38139419631.
macOS/Linux vẫn cần kiểm tra giao diện trên desktop thực tế trước khi phát cho nhân viên.
Không tự bật startup; người dùng chọn trong menu chuột phải/khay hệ thống.
Bấm bong bóng mở popup, giữ và kéo bong bóng để di chuyển, đóng popup để ẩn, menu Thoát để dừng app.
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
