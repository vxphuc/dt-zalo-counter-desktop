# Kiểm tra local — 29/10/2026

- Windows x64 1.0.12: build NSIS thành công; metadata generic đúng origin VPS.
- Đối chiếu ASAR: đúng version, mode automatic và electron-updater 6.8.11.
- 26 test desktop thành công; 1 test publish POSIX bỏ qua trên Windows. Test này
  được chạy khi workflow build trên macOS; chưa có kết quả CI cho mã mới.
- ElectronHttpExecutor + NsisUpdater thật: đọc latest.yml từ localhost, tải EXE
  1.0.12 theo đường dẫn có version, xác minh SHA512; file cố ý hỏng bị từ chối.
  Không thực thi installer hoặc thay app đang cài trong kiểm tra.
- Kiểm tra SHA256 gói publish thành công; npm audit --omit=dev không báo lỗ hổng.
- CRM build và lint App.tsx/vite.config.ts thành công; 21 unit test thành công.
- Chrome local tại 1440/390/320px: trang tải không tràn ngang, đủ 3 kiến trúc;
  metadata 404 và link ngoài origin bị chặn, Thử lại phục hồi link hợp lệ.
- Chưa build/thử app trên Mac thật. Chưa thử nâng cấp một app đã cài sang version
  tiếp theo hoặc nạp snippet vào Nginx thật; cần các bước xác nhận trong README.
- SSH đến VPS trả Permission denied; không upload, thay Nginx, deploy hoặc push
  source trong phiên làm việc này. Trang tải trên VPS chưa được công bố.

Ảnh và báo cáo kiểm tra tại `../output/desktop-download-qa` trong workspace gốc.
Gói Windows tại `../output/desktop-assistant/win-x64/1.0.12/publish`.
