# Phát hành bộ cài qua VPS — 1.0.12

Đường dẫn dự kiến sau khi triển khai:

- Trang tải công khai: **https://dtzalobe.io.vn/tai-app/** (không cần đăng nhập).
- Bộ cài/metadata: `/downloads/desktop/win-x64/`, `/mac-x64/`, `/mac-arm64/`.
- File vật lý trên VPS: `/var/www/dt-zalo-downloads`, tách khỏi thư mục CRM `dist`.

Windows tự kiểm tra sau khi mở 15 giây và mỗi 6 giờ, tải nền, rồi hỏi khi nào khởi
động lại để cài. Không tự thoát lúc đang nhập phiếu, không tự cài khi thoát thông
thường. Menu chuột phải có **Kiểm tra bản cập nhật** và **Trang tải bộ cài**.
Lỗi mạng không chặn mở CRM; người dùng có thể kiểm tra lại.

Theo lựa chọn hiện tại của chủ dự án, Mac chưa có Developer ID: app tự báo bản
mới và mở DMG đúng kiến trúc để người dùng thoát app, kéo vào Applications và
chọn Replace. Không cố tự cài bản Mac chưa ký. Mac đã cài bản cũ và Windows
1.0.11 trở về trước cần cài đè 1.0.12 **một lần** để nhận chức năng kiểm tra này.
Giữ nguyên app ID, tên EXE và thư mục dữ liệu; không xóa cấu hình/đăng nhập cũ.

Chỉ phát hành Windows x64, Mac Intel x64 và Mac Apple Silicon arm64. Không còn
job hoặc lệnh build Linux trong quy trình mới. Những ghi chú Linux cũ là lịch sử.

## 1. Tạo bộ cài

Commit/push repo desktop và frontend trước khi thực hiện các lệnh git pull trên VPS.
Chưa có lệnh nào trong tài liệu này được chạy trên VPS bởi trợ lý.

Windows local, PowerShell:

```powershell
cd D:\LamWeb\System_ZaloOA_FullShop\desktop-assistant
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Install failed' }
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
npm.cmd run build
```

Bộ cài và gói sẵn sàng đưa lên VPS:

`output/desktop-assistant/win-x64/1.0.12/publish/`

Thư mục gồm EXE, blockmap, `latest.yml`, `latest.json`, `SHA256.txt`. Upload
**nguyên thư mục publish**, không chỉ EXE và không upload `win-unpacked`.
`npm run build` dùng script tạo cả bộ cài lẫn gói publish; không chạy trực tiếp
electron-builder để phát hành. Mỗi phiên bản phải bất biến: sửa mã sau khi đã
phát hành thì tăng version bằng `npm.cmd version patch --no-git-tag-version`.
Nếu build lại cùng version chưa phát hành, lưu thư mục `publish` cũ sang nơi
khác trước; script không ghi đè gói publish để tránh nhầm hai bộ cài cùng tên.

Mac: vào repo GitHub → Actions → **Build desktop installers** → Run workflow.
Giữ `mac_signed` là **false** khi chưa có Apple Developer. Quy trình chạy 3 job:
win-x64, mac-x64, mac-arm64. Tải và giải nén artifact; nội dung đã là gói publish.
DMG chỉ build trên macOS/GitHub Actions macOS, không thể build từ Windows.
Artifact giữ 14 ngày; VPS lưu lâu dài, không yêu cầu người tải đăng nhập GitHub.

## 2. Chuẩn bị VPS một lần

VPS chạy script phát hành cần Node.js >= 18.20 (khuyến nghị 22); không build app
trên VPS. Build local/CI dùng Node.js 22. Dùng SSH hiện có, không gửi mật khẩu/key vào chat.

```bash
node --version
umask 022
mkdir -p /opt/dt-zalo-incoming /var/www/dt-zalo-downloads
git clone https://github.com/vxphuc/dt-zalo-counter-desktop.git /opt/dt-zalo-counter-desktop
cd /opt/dt-zalo-counter-desktop
npm ci --omit=dev --ignore-scripts
```

Nếu repo đã clone thì `git pull --ff-only origin main`, không clone lại.
`--ignore-scripts` trên VPS tránh chạy bước cài Electron; VPS chỉ phục vụ file,
không build hoặc chạy giao diện desktop.

Sao chép snippet Nginx:

```bash
install -m 644 /opt/dt-zalo-counter-desktop/deployment/downloads.nginx.conf /etc/nginx/snippets/dt-zalo-downloads.conf
nginx -T 2>&1 | less
```

Trong **server HTTPS đang phục vụ `dtzalobe.io.vn`**, thêm đúng một dòng:

```nginx
include /etc/nginx/snippets/dt-zalo-downloads.conf;
```

Không thêm vào server `api.dtzalobe.io.vn`, không chép đè cấu hình SSL hoặc
thay root hiện hành. Kiểm tra và nạp lại:

```bash
nginx -t && systemctl reload nginx
```

Snippet giữ metadata không cache; Nginx phục vụ download/Range trực tiếp,
không qua Flask và không mở danh sách thư mục. Không dùng `disable_symlinks on`
cho thư mục này vì metadata đi qua symlink `current` để đổi phiên bản nguyên tử.

## 3. Upload và phát hành từng kiến trúc

Ví dụ Windows local, PowerShell (đối chiếu lại IP VPS trước khi chạy):

```powershell
scp -r D:\LamWeb\System_ZaloOA_FullShop\output\desktop-assistant\win-x64\1.0.12\publish root@103.124.92.230:/opt/dt-zalo-incoming/win-x64-1.0.12
```

Mac: giải nén artifact ra thư mục, rồi upload nội dung tương tự đến
`/opt/dt-zalo-incoming/mac-x64-1.0.12` và `/opt/dt-zalo-incoming/mac-arm64-1.0.12`.
Các thư mục đầu vào phải trực tiếp chứa `latest.json` và `SHA256.txt`.

Trên VPS, sau khi repo desktop đã cập nhật:

```bash
cd /opt/dt-zalo-counter-desktop &&
git pull --ff-only origin main &&
npm ci --omit=dev --ignore-scripts &&
node scripts/publish-release.cjs /opt/dt-zalo-incoming/win-x64-1.0.12
```

Sau đó phát hành từng Mac đã upload:

```bash
cd /opt/dt-zalo-counter-desktop &&
node scripts/publish-release.cjs /opt/dt-zalo-incoming/mac-x64-1.0.12 &&
node scripts/publish-release.cjs /opt/dt-zalo-incoming/mac-arm64-1.0.12
```

Mỗi lệnh xác minh checksum và metadata trước khi phát hành; file bộ cài đặt ở
`<track>/releases/<version>/`, metadata chuyển cùng một symlink `current`.
Không thay file của bản đã có, không hạ phiên bản và không xóa bản cũ đang được
người dùng tải. Khóa `.publish-lock` chặn hai lệnh cùng phát hành một kiến trúc.
Nếu lệnh lỗi, dừng và xem lỗi trước khi tiếp tục; không tự xóa thư mục releases.

## 4. Cập nhật trang tải CRM

```bash
cd /var/www/zalo-oa-frontend &&
git pull --ff-only origin master &&
bash docs/update-private-voucher-codes.sh
```

Kiểm tra:

```bash
curl -fsS https://dtzalobe.io.vn/downloads/desktop/win-x64/latest.json
curl -fsS https://dtzalobe.io.vn/downloads/desktop/win-x64/latest.yml
curl -I https://dtzalobe.io.vn/tai-app/
curl -I -H 'Range: bytes=0-1023' https://dtzalobe.io.vn/downloads/desktop/win-x64/releases/1.0.12/DT-Zalo-Counter-Setup-1.0.12.exe
```

Mở trang tải, tải từng file thật và đối chiếu SHA256. Kiểm tra Windows bằng hai
bản đã cài (1.0.12 → version cao hơn), chọn **Để sau**, sau đó cài và mở lại;
đảm bảo startup, vị trí bong bóng và phiên đăng nhập còn nguyên. Chỉ công bố
version cao hơn sau khi bản ứng viên đã được kiểm tra trên máy thử nghiệm.
Với Mac, kiểm tra tải đúng chip và cài đè từ Applications trên máy Mac thật.

## Khi có Apple Developer sau này

Thêm repo Actions secrets: `CSC_LINK` (P12 base64), `CSC_KEY_PASSWORD`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Chọn `mac_signed: true`.
Script yêu cầu đủ thông tin, bật hardened runtime, ký + notarize và build
DMG + ZIP. Không truyền secrets vào source hoặc file cho khách tải.
Đổi từ bản ad-hoc sang Developer ID cần cài đè bản ký lần đầu; các bản ký sau
dùng cùng danh tính để tự cập nhật. Chỉ phát hành khi đã kiểm tra trên Mac thật.

Tham khảo chính thức cho electron-builder 26:
https://www.electron.build/v26/docs/features/auto-update/
https://www.electron.build/v26/docs/mac/
