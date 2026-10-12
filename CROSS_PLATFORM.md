# Bộ cài Windows, macOS và Linux

Phiên bản hiện tại là **1.0.6**, cập nhật thủ công bằng cách tải bộ cài rồi cài đè.
Xem [AUTO_UPDATE.md](AUTO_UPDATE.md). Các tên file 1.0.1 và run bên dưới là bản đầu
tiên hỗ trợ nhiều OS; đổi số phiên bản theo bản bạn đang tải.

Mã nguồn dùng chung bong bóng nổi, popup đăng nhập CRM và tạo QR cấp lượt tại quầy.
Không đổi backend/CRM để thêm OS. Vẫn cần BE/migration `b8e1c4a6d209`, CRM và Mini App
có phiếu riêng trước khi cấp lượt cho khách thật.

| Máy người dùng | Bộ cài | Nơi build |
| --- | --- | --- |
| Windows 64-bit | `DT-Zalo-Counter-Setup-1.0.1.exe` | Windows |
| Mac Intel | `DT-Zalo-Counter-1.0.1-macOS-x64.dmg` | macOS |
| Mac Apple Silicon M1/M2/M3/M4… | `DT-Zalo-Counter-1.0.1-macOS-arm64.dmg` | macOS |
| Linux x64 | `DT-Zalo-Counter-1.0.1-Linux-x64.AppImage` hoặc `.deb` | Linux |
| Linux ARM64 | `DT-Zalo-Counter-1.0.1-Linux-arm64.AppImage` hoặc `.deb` | Linux ARM64 |

Đầu ra nằm trong `../output/desktop-assistant`. Cấu hình không tự upload hay publish.
Đã build và lưu đủ bộ cài trên runner Windows/macOS/Linux ngày 11/10/2026.
Chưa thử giao diện macOS/Linux trên desktop thực tế của nhân viên.

## Tạo bộ cài bằng GitHub Actions từ máy Windows

Repo app riêng: https://github.com/vxphuc/dt-zalo-counter-desktop (Private).
Thư mục này có Git riêng, độc lập với repo backend/frontend.
Workflow đã chuẩn bị tại `.github/workflows/build-installers.yml`; hỗ trợ source ở
root repo hoặc trong thư mục `desktop-assistant` của repo chứa nhiều dự án.

Lượt build đã thành công: https://github.com/vxphuc/dt-zalo-counter-desktop/actions/runs/38139419631.
Tải bộ cài ở Artifacts của trang này. Artifacts giữ 14 ngày; lưu bộ cài về máy để sử dụng lâu dài.
Sau đó có thể build lại bằng **Actions → Build desktop installers → Run workflow**.
Muốn thêm repo vào GitHub Desktop: **File → Add local repository**, chọn thư mục `desktop-assistant`.

Các bước sau dùng khi đưa source sang repository khác:

1. Đưa source app vào repository GitHub, gồm `.github`, `assets`, `scripts`, `tests`,
   các file `*.cjs`, `bubble.*`, `package.json`, `package-lock.json`, `.gitignore`, README
   và tài liệu này. Không đưa `node_modules` hoặc `.env` vào repo. Bộ source ZIP có sẵn trong output.
2. Workflow phải ở **root repo**: `.github/workflows/build-installers.yml`.
   Nếu đặt source trong `desktop-assistant/`, chuyển bản workflow ra root repo.
3. Push lên nhánh mặc định. Trong GitHub chọn **Actions → Build desktop installers → Run workflow**.
4. Các máy build chạy test rồi tạo bộ cài theo từng OS/kiến trúc, không tạo Release.
5. Khi job thành công, tải **Artifacts** tương ứng `DT-Zalo-Counter-mac-arm64`,
   `DT-Zalo-Counter-mac-x64`, `DT-Zalo-Counter-linux-x64`… và giải nén để lấy bộ cài.
   File `SHA256-1.0.1.txt` đi kèm ghi hash của bộ cài.

Workflow chỉ chạy thủ công. Mac/Linux cần được thử trên máy thật trước khi phát
cho nhân viên; workflow build thành công chưa xác nhận hành vi cửa sổ trên mọi desktop.
GitHub Actions dùng hạn mức/phí của tài khoản cho repo private:
https://docs.github.com/en/actions/reference/runners/github-hosted-runners.

## Build trực tiếp

Cần Node.js 22.12+ và npm. Chạy trong thư mục source của app.

Windows (PowerShell):

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run checksums
```

Mac Apple Silicon:

```bash
npm ci
npm test
npm run build:mac -- --arm64
npm run checksums
```

Mac Intel dùng `npm run build:mac -- --x64`.

Linux x64:

```bash
npm ci
npm test
npm run build:linux -- --x64
npm run checksums
```

Linux ARM64 dùng `npm run build:linux -- --arm64` trên máy ARM64.
Windows không build trực tiếp DMG; dùng máy Mac hoặc workflow trên.

## Cài và chạy

Windows: mở EXE và theo hướng dẫn. Mac: mở DMG đúng chip, kéo app vào Applications
rồi chạy app từ Applications. Windows chưa ký chứng thư; macOS dùng chữ ký ad-hoc
để chạy trên ARM64, chưa ký Developer ID/notarize. Nếu macOS chặn app, chỉ xác nhận
app tin cậy này trong **System Settings → Privacy & Security → Open Anyway** theo
chính sách của máy. Không cần tắt Gatekeeper. Phát hành rộng cần Developer ID và
notarization; startup trên Mac chưa notarize có thể không đăng ký thành công.

Linux Ubuntu/Debian: cài file `.deb` đúng kiến trúc bằng trình quản lý phần mềm,
hoặc `sudo apt install ./DT-Zalo-Counter-1.0.1-Linux-x64.deb` trong thư mục tải về.
Không chạy Electron bằng root hoặc `--no-sandbox`.

Linux AppImage: giữ file ở vị trí cố định rồi chạy:

```bash
chmod +x DT-Zalo-Counter-1.0.1-Linux-x64.AppImage
./DT-Zalo-Counter-1.0.1-Linux-x64.AppImage
```

AppImage cần FUSE theo cấu hình bản phân phối; nếu máy không hỗ trợ thì dùng `.deb`
trên Ubuntu/Debian. Không xóa/di chuyển AppImage sau khi bật khởi động cùng máy.

Bấm bong bóng để mở popup, giữ/kéo trên bong bóng để di chuyển. Khởi động cùng máy mặc định tắt;
bật bằng menu chuột phải hoặc khay hệ thống. Linux tạo riêng
`~/.config/autostart/vn.dtzalobe.counter.desktop` (hoặc thư mục `XDG_CONFIG_HOME`),
và xóa đúng file này khi tắt tùy chọn. Bản chạy dev không đăng ký startup.

## Cửa sổ nổi trên từng hệ điều hành

- Windows: giữ cơ chế always-on-top như bản trước, trên cửa sổ thông thường.
- macOS: always-on-top và hiển thị trên các Spaces, kể cả không gian ứng dụng full screen.
- Linux: dùng X11/XWayland nếu có `DISPLAY` để hỗ trợ vị trí/kéo cửa sổ và nổi trên cùng.
  Trên Wayland không có XWayland, app vẫn dùng backend mặc định nhưng không đảm bảo
  đặt vị trí hoặc nổi trên các cửa sổ khác; cần bật XWayland hoặc đăng nhập phiên Xorg/X11.
  Menu chuột phải trên bong bóng vẫn dùng được nếu desktop không có khay hệ thống.

Không hứa hiển thị trên màn hình khóa/UAC/cửa sổ hệ thống được bảo vệ. Trên Linux,
window manager vẫn quyết định thứ tự hiển thị. Tài liệu Electron:
https://www.electronjs.org/docs/latest/api/browser-window#platform-notices.

## Kiểm chứng

8 unit tests kiểm tra HTTPS, navigation, bounds, API theo OS, startup Linux và escape
đường dẫn trong Desktop Entry. Schema electron-builder đã xác minh. Các test này
không thay thế kiểm tra trên Mac/Linux thật. Workflow run `38139419631` đạt đủ 5 jobs:
Windows x64, macOS x64/ARM64, Linux x64/ARM64; mỗi job chạy đủ 8 tests trước khi đóng gói.
Native smoke với CRM fixture trên Windows: xem README.
Đã build EXE 1.0.1 và chạy native smoke Windows thành công: mở/ẩn bong bóng,
đăng nhập đúng popup, 450.000đ cấp 2 lượt, tạo QR, retry không cấp trùng, renderer CRM
không có Node/native bridge. Chưa có kết quả native smoke cho macOS/Linux.
