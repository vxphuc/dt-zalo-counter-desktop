# Cập nhật app Windows, macOS và Linux — từ bản 1.0.4

App lấy bản mới từ HTTPS trên VPS, không cần tài khoản GitHub của người dùng.
Repo mã nguồn vẫn private. Mỗi hệ điều hành và loại chip có kênh riêng.

## 1. Người dùng cập nhật thế nào?

Người đang dùng 1.0.3 hoặc cũ hơn cần **cài đè bản 1.0.4 một lần**, không cần gỡ app.
Các bản cũ chưa có bộ kiểm tra cập nhật. Bản 1.0.4 giữ nguyên app ID và nơi lưu
cấu hình; không có thao tác xóa dữ liệu người dùng khi cập nhật.

Sau khi kênh trên VPS đã hoạt động:

1. App kiểm tra sau khi mở 15 giây, rồi mỗi 6 giờ nếu vẫn chạy.
2. Hoặc bấm chuột phải bong bóng/biểu tượng khay hệ thống → **Kiểm tra cập nhật**.
3. Có bản mới thì app tải nền, kiểm tra hash của bộ cài và báo khi tải xong.
4. Hoàn tất phiếu đang nhập rồi chọn **Khởi động lại để cập nhật**. Chọn **Để sau**
   nếu đang làm việc; app không tự đóng hoặc tự cài khi bạn thoát bình thường.

| Hệ điều hành/bộ cài | Cách cài bản cập nhật |
| --- | --- |
| Windows x64 `.exe` | App mở bộ cài NSIS và khởi động lại. Không cần gỡ bản cũ. |
| macOS Intel/Apple Silicon | Chỉ bản đã ký Developer ID mới bật tự cập nhật; cần DMG **và ZIP** trong kênh. |
| Linux `.AppImage` | Thay AppImage tại vị trí đang chạy rồi khởi động lại. File và thư mục phải cho tài khoản người dùng ghi. |
| Ubuntu/Debian `.deb` | App tải `.deb`, nút **Mở bộ cài cập nhật** mở trình cài của hệ điều hành. Xác nhận quyền quản trị tại đó, sau đó thoát/mở app lại. |

Với `.deb`, không chạy app bằng root. Nếu máy không có ứng dụng mở `.deb`, dùng
trình quản lý phần mềm hoặc `sudo apt install /đường/dẫn/file.deb` mà thông báo chỉ ra.
AppImage là lựa chọn thuận tiện nhất trên Linux nếu muốn cập nhật ngay trong app.
Thay đổi giao diện CRM lấy từ web trên VPS, vẫn cần cập nhật frontend riêng;
không nhất thiết tăng phiên bản app nếu chỉ sửa nội dung web.

## 2. Build trên GitHub Actions

Repo: https://github.com/vxphuc/dt-zalo-counter-desktop (private).
Workflow: **Actions → Build desktop installers → Run workflow**.

Lần đầu, đưa mã đã chuẩn bị lên repo từ PowerShell:

```powershell
cd D:\LamWeb\System_ZaloOA_FullShop\desktop-assistant
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw "Test app thất bại." }
python -m unittest discover -s tests -p 'test_*.py'
if ($LASTEXITCODE -ne 0) { throw "Test bộ phát hành thất bại." }
git status --short
git add .github/workflows/build-installers.yml .gitignore main.cjs platform-support.cjs package.json package-lock.json update-controller.cjs assets/entitlements.mac.plist scripts/package.cjs scripts/prepare-release.cjs deployment tests README.md CROSS_PLATFORM.md AUTO_UPDATE.md
git commit -m "Add desktop updates for Windows macOS and Linux"
if ($LASTEXITCODE -ne 0) { throw "Commit chưa thành công; kiểm tra git status." }
git push origin main
if ($LASTEXITCODE -ne 0) { throw "Push chưa thành công." }
```

Nếu đã có commit mới trên GitHub do Codex đẩy lên, không commit lại các thay đổi cũ;
chỉ chạy workflow. Nếu Git báo `dubious ownership` tại repo này, dùng đúng ngoại lệ:

```powershell
git config --global --add safe.directory D:/LamWeb/System_ZaloOA_FullShop/desktop-assistant
```

Chọn nhánh **main**. Khi chưa có chứng thư Apple, để ô **Ký Developer ID và notarize
macOS** không chọn. Workflow vẫn tạo đủ bộ cài, nhưng Mac chưa có kênh tự cập nhật.
Khi có đủ Secrets ở mục 4, chọn ô này để tạo bản Mac ký/notarize.

Đợi 5 job build và job **Bundle for VPS** đều xanh. Tải artifact
**DT-Zalo-Counter-VPS-update-bundle** và giải nén ZIP ngoài cùng. Trong đó có:

- `desktop-updates.zip`: bộ cài và thông tin phiên bản cho 5 OS/kiến trúc.
- `publish-updates.py`: kiểm tra hash, kiến trúc, phiên bản và đưa file lên kênh.
- `nginx-location.conf`: cấu hình đường dẫn HTTPS cập nhật.
- `AUTO_UPDATE.md`: hướng dẫn này.

Artifacts của GitHub giữ 14 ngày; file đã đưa lên VPS không phụ thuộc thời hạn đó.
Không đặt token GitHub, chứng thư hoặc mật khẩu vào cấu hình app.

## 3. Đưa bộ cập nhật lên VPS

Thực hiện một lần cấu hình Nginx, các bản sau chỉ cần upload và chạy publisher.
Ví dụ dưới dùng `/opt/dt-zalo-counter-updates` làm nơi nhận bundle và
`/var/www/dt-zalo-counter-updates` làm nơi phục vụ bộ cài. Không thay thế cấu hình
CRM hoặc SSL đang dùng.

### Upload từ máy Windows

Mở PowerShell tại thư mục đã giải nén artifact. Thay `IP_VPS` bằng IP/hostname SSH
mà bạn thường dùng, không dùng nguyên chữ `IP_VPS`:

```powershell
ssh root@IP_VPS "mkdir -p /opt/dt-zalo-counter-updates"
scp desktop-updates.zip publish-updates.py nginx-location.conf root@IP_VPS:/opt/dt-zalo-counter-updates/
if ($LASTEXITCODE -ne 0) { throw "Upload chưa thành công." }
```

### Kiểm tra và phát hành trên VPS

SSH vào VPS rồi chạy Bash:

```bash
(
set -eu
cd /opt/dt-zalo-counter-updates
python3 publish-updates.py desktop-updates.zip --verify-only
python3 publish-updates.py desktop-updates.zip
)
```

Publisher kiểm tra toàn bộ bundle trước khi ghi, không phát hành lùi phiên bản,
không ghi đè một bộ cài cùng tên bằng nội dung khác. Bộ cài được ghi trước, file
`latest*.yml` ghi sau. Các bộ cài cũ được giữ để tránh lỗi khi khách đang tải dở.
Nếu báo `increase app version first`, tăng version và build lại, không xóa bộ cài
đang phục vụ để ép ghi đè.

### Cấu hình Nginx lần đầu

Các lệnh này dành cho **Nginx chạy trực tiếp trên host VPS**. Nếu HTTPS do container
Nginx phục vụ, cần mount thư mục bộ cài/cấu hình vào container trước, đường dẫn alias
phải có thật bên trong container. Không dùng cấu hình host cho một container chưa mount.

```bash
install -d -m 755 /etc/nginx/snippets
install -m 644 /opt/dt-zalo-counter-updates/nginx-location.conf /etc/nginx/snippets/dt-counter-updates.conf
nginx -T 2>&1 | less
```

Trong output `nginx -T`, tìm file có `server_name dtzalobe.io.vn` và server HTTPS
đang phục vụ CRM. Mở đúng file đó, sao lưu trước khi sửa. Thêm dòng sau **bên trong
khối `server { ... }` HTTPS**, ngang cấp các khối `location`, không đặt trong `location /`:

```nginx
include /etc/nginx/snippets/dt-counter-updates.conf;
```

Kiểm tra rồi reload:

```bash
nginx -t && systemctl reload nginx
curl -fsS https://dtzalobe.io.vn/desktop-updates/win-x64/latest.yml
curl -fsS https://dtzalobe.io.vn/desktop-updates/linux-x64/latest-linux.yml
curl -fsS https://dtzalobe.io.vn/desktop-updates/linux-arm64/latest-linux-arm64.yml
```

Kết quả phải là YAML có `version: 1.0.4` và tên bộ cài, không phải HTML trang CRM.
Sau khi phát hành Mac đã ký, kiểm tra thêm:

```bash
curl -fsS https://dtzalobe.io.vn/desktop-updates/mac-x64/latest-mac.yml
curl -fsS https://dtzalobe.io.vn/desktop-updates/mac-arm64/latest-mac.yml
```

Kênh Mac chưa ký sẽ không có `latest-mac.yml` (404 là đúng). Bộ cài Mac vẫn nằm ở
đường dẫn kênh tương ứng để tải thủ công. Mỗi kênh là thư mục riêng, không trộn
metadata x64 và ARM64. Nginx phục vụ đường dẫn thiếu bằng 404, không chuyển sang SPA.

## 4. Tạo chứng thư Apple và Secrets cho macOS

Bạn cần sử dụng một máy Mac để tạo khóa/chứng thư. Sau bước này, build Intel và
Apple Silicon đều có thể chạy trên GitHub Actions từ máy Windows.

### Đăng ký Apple Developer

1. Tạo hoặc dùng Apple Account của bạn, bật xác thực hai yếu tố.
2. Vào https://developer.apple.com/programs/enroll/ và đăng ký **Apple Developer
   Program**, chọn cá nhân hoặc tổ chức theo chủ sở hữu ứng dụng. Hoàn tất xác minh
   và thanh toán phí hội viên mà Apple hiển thị.
3. Khi tài khoản đã được kích hoạt, mở https://developer.apple.com/account/.
   Trong Membership details, ghi lại **Team ID**.

### Tạo Developer ID Application trên máy Mac

1. Mở **Keychain Access → Certificate Assistant → Request a Certificate From a
   Certificate Authority**. Nhập email/tên, chọn **Saved to disk**, lưu CSR.
2. Trong Apple Developer → **Certificates, Identifiers & Profiles → Certificates**,
   bấm `+`, chọn **Developer ID Application**, tải CSR lên và tạo chứng thư.
   Loại này dùng ký ứng dụng phát hành ngoài Mac App Store; không chọn
   `Developer ID Installer` thay cho chứng thư ứng dụng.
3. Tải file `.cer`, mở trên chính máy Mac đã tạo CSR. Trong Keychain → **My
   Certificates**, chứng thư phải có private key bên dưới khi mở mũi tên.
4. Chọn chứng thư kèm private key → **Export Items** → lưu `.p12`. Đặt mật khẩu
   bảo vệ file; lưu an toàn, không đưa file/mật khẩu lên Git hoặc gửi vào chat.
5. Chuyển `.p12` sang Base64 để dán vào Secret trên GitHub. Ví dụ Terminal trên Mac:

```bash
base64 < "$HOME/Downloads/DeveloperID.p12" | pbcopy
```

Đổi đường dẫn theo file thật. Lệnh đưa Base64 vào clipboard, không cần gửi giá trị
đó cho tôi. Nếu không thấy private key, quay về máy đã tạo CSR để export lại.

### Tạo mật khẩu riêng cho notarization

Vào https://account.apple.com/ → **Sign-In and Security → App-Specific Passwords**,
tạo mật khẩu cho GitHub notarization. Dùng mật khẩu này thay cho mật khẩu đăng nhập
Apple Account. Chứng thư ký và thông tin notarize phải thuộc cùng đội Apple Developer.

### Thêm 5 GitHub Repository Secrets

Repo desktop → **Settings → Secrets and variables → Actions → New repository secret**:

| Tên Secret chính xác | Nội dung |
| --- | --- |
| `MAC_CSC_LINK` | Base64 của file `.p12` vừa export |
| `MAC_CSC_KEY_PASSWORD` | Mật khẩu bảo vệ file `.p12` |
| `APPLE_ID` | Email Apple Account có quyền notarize cho đội này |
| `APPLE_APP_SPECIFIC_PASSWORD` | Mật khẩu riêng cho ứng dụng vừa tạo |
| `APPLE_TEAM_ID` | Team ID trong Membership details |

Chạy workflow và chọn **Ký Developer ID và notarize macOS**. Thiếu Secret thì build
ký sẽ dừng; không âm thầm chuyển sang bản chưa ký. Workflow kiểm tra chữ ký
Developer ID, Gatekeeper và vé notarization trước khi cho tải artifact.

Nếu đã phát hành bản Mac chưa ký 1.0.4, dùng **1.0.5 hoặc cao hơn** cho bản ký;
không dùng cùng một version với bộ cài đã phát hành. Người dùng Mac cần cài đè
bản đã ký lần đầu từ DMG, chạy app trong `/Applications`; từ đó mới tự cập nhật.
Các bản cập nhật sau tiếp tục dùng cùng danh tính ký/Team và app ID.

Hướng dẫn Apple:

- [Tham gia Apple Developer Program](https://developer.apple.com/programs/enroll/)
- [Tạo CSR](https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request)
- [Tạo Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)
- [Code signing và notarization với electron-builder](https://www.electron.build/v26/docs/notarization/)

## 5. Phát hành các bản tiếp theo

Không phải gỡ/cài lại thủ công trên máy người dùng đã có bản hỗ trợ cập nhật.
Mỗi lần sửa native app, tăng version trước khi build:

```powershell
cd D:\LamWeb\System_ZaloOA_FullShop\desktop-assistant
npm.cmd version patch --no-git-tag-version
if ($LASTEXITCODE -ne 0) { throw "Không tăng được version." }
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw "Test thất bại." }
python -m unittest discover -s tests -p 'test_*.py'
if ($LASTEXITCODE -ne 0) { throw "Test phát hành thất bại." }
git status --short
# Thêm các file vừa sửa, luôn gồm package.json và package-lock.json.
git add package.json package-lock.json
# git add <các file mã nguồn vừa sửa>
git commit -m "Release desktop update"
if ($LASTEXITCODE -ne 0) { throw "Commit chưa thành công." }
git push origin main
if ($LASTEXITCODE -ne 0) { throw "Push chưa thành công." }
```

Chạy workflow, tải bundle mới, upload lại và chạy hai lệnh publisher ở mục 3.
Không cần sửa Nginx lần nữa. Không thay app ID, feed URL hoặc Team ký tùy tiện.

## 6. Kiểm tra thực tế trước khi phát rộng

Unit tests kiểm tra chọn kênh/kiến trúc, tải nền, xác nhận trước khi cài, lỗi mạng,
bộ cài `.deb`, hash và phát hành không lùi phiên bản. Build thành công chưa thay thế
thử cài cập nhật trên từng máy thực tế.

Trên mỗi OS: cài bản hỗ trợ cập nhật, phát hành version cao hơn trên VPS, thử
**Kiểm tra cập nhật → Để sau**, xác nhận app vẫn hoạt động, rồi cập nhật và kiểm tra
version trong menu. Thử thêm mất mạng và kiểm tra đăng nhập/cấu hình vẫn còn.
Mac chỉ thử luồng này sau khi có bản ký/notarize. Linux thử riêng AppImage và `.deb`.

Tài liệu cơ chế cập nhật: https://www.electron.build/v26/docs/features/auto-update/.
