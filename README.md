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

Bộ cài Windows hiện tại ở `../output/desktop-assistant/DT-Zalo-Counter-Setup-1.0.10.exe`, chưa ký số.
Phiên bản 1.0.10 tự đăng ký khởi động cùng máy khi mở bản đóng gói lần đầu.
Chỉ bong bóng hiện khi đăng nhập hệ điều hành; popup CRM vẫn ẩn cho tới khi bấm.
Có thể tắt/bật qua menu chuột phải. Lựa chọn được lưu; các lần mở sau không tự bật lại
khi người dùng đã tắt qua menu hoặc cài đặt hệ điều hành. Bản dev không đăng ký startup.
Xem [COUNTER_1_0_10.md](../deployment/COUNTER_1_0_10.md).

Phiên bản 1.0.9 thu chiều cao popup thêm 10% xuống 408×520; giữ cỡ chữ và chiều rộng.
Form CRM chỉ có ô chọn game, bỏ ô tìm game. Cập nhật frontend trên VPS và cài bản desktop
1.0.9 để áp dụng đủ thay đổi. Xem [COUNTER_1_0_9.md](../deployment/COUNTER_1_0_9.md).

Phiên bản 1.0.8 thu popup thêm 15% xuống 408×578; form desktop dùng tỷ lệ 68%.
Cấu hình hóa đơn tối thiểu/lượt cố định/hạn phiếu nằm trong game cá nhân trên CRM.
Form bỏ tiêu đề và đăng xuất; chỉ hiện bộ chọn cửa hàng khi quản lý nhiều cửa hàng.
Game mới nhất được chọn mặc định, sản phẩm chỉ gợi ý khi tìm kiếm; cấp xong có link
trình chiếu đúng game. Cần cập nhật backend và frontend trước khi dùng cơ chế mới;
không có migration mới. Xem [COUNTER_1_0_8.md](../deployment/COUNTER_1_0_8.md).
Phiên bản 1.0.7 dùng logo `frontend/public/logo3.jpg` được đóng gói tại `assets/logo3.jpg`
cho bong bóng desktop. Viền ngoài giảm từ 6 xuống 2 px, viền trắng từ 2 xuống 1 px;
bong bóng vẫn rộng 66 px, giữ thao tác bấm, kéo và menu như cũ.
Phiên bản 1.0.6 thu bong bóng từ 78 xuống 66 px (khoảng 15%), giữ thao tác kéo và lưu vị trí.
CRM thêm tab kiểm tra voucher/quà tại quầy, form giãn khoảng cách và thông báo cấp lượt
tự tắt sau 3 giây. QR cá nhân xuất hiện ở trình chiếu đúng game và ẩn khi khách liên kết
đúng SĐT nhận phiếu, chờ lần cấp tiếp theo. Cần triển khai backend/migration và frontend.
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
Từ 1.0.10, startup mặc định bật trong lần mở bản đóng gói đầu tiên; người dùng có thể tắt
qua menu chuột phải/khay hệ thống. 1.0.9 trở về trước cần bật thủ công.
Bấm bong bóng mở popup, giữ và kéo bong bóng để di chuyển, đóng popup để ẩn, menu Thoát để dừng app.
Always-on-top áp dụng cho cửa sổ thông thường, không vượt màn hình khóa/UAC Windows.
macOS hỗ trợ các Spaces/full screen; Linux ưu tiên X11/XWayland để giữ vị trí cửa sổ nổi.

App chỉ hoạt động đủ luồng khi đã cập nhật BE/migration `b8e1c4a6d209`, CRM và phát
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
