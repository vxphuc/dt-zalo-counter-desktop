# Cập nhật thủ công app desktop — bản 1.0.6

Dự án dùng cách tải bộ cài từ GitHub Actions rồi cài đè khi có bản mới.
App không tự kiểm tra/tải bản mới. Không cần đưa bundle cập nhật 1 GB lên VPS
hoặc đăng ký Apple Developer để dùng cách phát hành này.

## Người dùng tải và cập nhật

1. Mở https://github.com/vxphuc/dt-zalo-counter-desktop/actions và đăng nhập tài khoản
   có quyền truy cập repo. Repo hiện private; người không có quyền cần nhận bộ cài
   do bạn tải và gửi hoặc đặt ở một đường dẫn tải của bạn.
2. Chọn lượt **Build desktop installers** thành công của phiên bản mới.
3. Trong **Artifacts**, tải đúng hệ điều hành/kiến trúc rồi giải nén ZIP:

| Máy cần cài | Artifact |
| --- | --- |
| Windows 64-bit | `DT-Zalo-Counter-win-x64` |
| Mac Intel | `DT-Zalo-Counter-mac-x64` |
| Mac Apple Silicon M1/M2/M3/M4… | `DT-Zalo-Counter-mac-arm64` |
| Linux 64-bit Intel/AMD | `DT-Zalo-Counter-linux-x64` |
| Linux ARM64 | `DT-Zalo-Counter-linux-arm64` |

4. Hoàn tất phiếu đang nhập, bấm chuột phải bong bóng/biểu tượng khay hệ thống →
   **Thoát trợ lý** trước khi thay app.
5. Cài bản mới theo hệ điều hành:

- **Windows:** chạy `DT-Zalo-Counter-Setup-1.0.6.exe`, chọn cùng phạm vi người dùng
  và vị trí cài như bản cũ, cài đè. Không cần gỡ app trước.
- **macOS:** mở DMG đúng loại chip, kéo app vào **Applications**, chọn **Replace**
  khi được hỏi. Chạy app từ Applications. Bản Mac dùng chữ ký ad-hoc, chưa
  Developer ID/notarize; nếu bị chặn, xem **System Settings → Privacy & Security**
  và chỉ xác nhận mở app bạn tin cậy theo chính sách của máy, không tắt Gatekeeper.
- **Linux `.deb`:** cài bản mới đúng kiến trúc qua trình quản lý phần mềm, hoặc
  `sudo apt install ./ten-bo-cai-moi.deb`. Không chạy ứng dụng bằng root.
- **Linux AppImage:** thay file AppImage ở vị trí bạn lưu, cấp quyền chạy bằng
  `chmod +x ten-file.AppImage` và mở lại. Nếu đổi tên/đường dẫn, bật lại tùy chọn
  khởi động cùng Linux để lưu đường dẫn mới. Có thể dùng tên cố định như
  `DT-Zalo-Counter.AppImage` cho các lần thay sau.

App giữ cùng app ID và thư mục dữ liệu khi cài đè; không xóa thư mục cấu hình để
cập nhật. Các thay đổi giao diện CRM trên web vẫn triển khai bằng frontend trên VPS.

## Chủ dự án tạo bản mới

Trong PowerShell, tại repo desktop:

```powershell
cd D:\LamWeb\System_ZaloOA_FullShop\desktop-assistant
npm.cmd version patch --no-git-tag-version
if ($LASTEXITCODE -ne 0) { throw "Không tăng được phiên bản." }
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw "Test thất bại." }
git status --short
git add package.json package-lock.json
# Thêm từng file mã nguồn bạn vừa sửa bằng git add <tên-file>.
git commit -m "Release desktop installer"
if ($LASTEXITCODE -ne 0) { throw "Commit chưa thành công." }
git push origin main
if ($LASTEXITCODE -ne 0) { throw "Push chưa thành công." }
```

Sau đó chọn **Actions → Build desktop installers → Run workflow → main**.
Đợi đủ 5 job xanh, tải các artifact cần phát cho người dùng. Mỗi artifact gồm
bộ cài và `SHA256-<version>.txt`. Artifacts giữ 14 ngày, nên lưu bộ cài về máy
hoặc nơi phân phối của bạn để người dùng tải lâu dài.

Bản 1.0.5 chuyển về cập nhật thủ công. Không cần thực hiện lại các bước phát hành
bundle, Nginx hoặc GitHub Secrets trong hướng dẫn tự cập nhật trước đây.
