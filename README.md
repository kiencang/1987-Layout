# 1987-Layout

Dịch file PDF dài từ tiếng Anh sang tiếng Việt. Có khả năng giữ lại ảnh & công thức toán.

Link ứng dụng: https://aistudio.google.com/apps/9333e4c6-6b7a-442a-80ad-7b0a263c44ff?showPreview=true&showAssistant=true&fullscreenApplet=true

Ý tưởng của dự án này được phát triển dựa trên 2 dự án trước đó:
- silaBook: https://github.com/kiencang/silaBook
- PDF-silaTranslator-Online: https://github.com/kiencang/PDF-silaTranslator-Online

## Tuyên bố từ chối trách nhiệm
Công cụ này có thể được sử dụng cho mục đích nghiên cứu và học tập cá nhân.

1987-Layout cũng như người phát triển nó không đưa ra bất kỳ bảo đảm rõ ràng hay ngụ ý nào, cũng như không tuyên bố rằng công cụ sẽ vận hành hoàn hảo, chính xác hoặc cập nhật. Người phát triển sẽ không chịu trách nhiệm cho bất kỳ tổn thất hay thiệt hại nào phát sinh trực tiếp hoặc gián tiếp liên quan đến hoặc phát sinh từ việc sử dụng công cụ này.

## Ghi công

Ứng dụng được phát triển tối ưu hoàn toàn ở phía Client-side (Trình duyệt). Một số thư viện quan trọng mà ứng dụng này dùng:

### 1. Khung Phát Triển Chính (Core Engine)
*   **[Angular](https://angular.dev/)**: Khung ứng dụng web đơn trang (SPA).

### 2. Giao Diện
*   **[Tailwind CSS](https://tailwindcss.com/)**: Framework utility-first CSS hỗ trợ xây dựng giao diện.
*   **[Angular Material Icons](https://material.angular.io/)**: Cung cấp hệ thống icon.

### 3. Xử Lý Tài Liệu
*   **[Mozilla PDF.js](https://mozilla.github.io/pdf.js/)** – Phát triển bởi **Mozilla**. Thư viện chạy hoàn toàn trên Client-side, giúp trích xuất hình ảnh trong file PDF.
*   **[pdf-lib](https://pdf-lib.js.org/)**: Dùng để chia tách PDF thành các chunk (đoạn) để dễ xử lý hơn.
*   **[Marked & marked-footnote](https://marked.js.org/)**: Chuyển Markdown sang cấu trúc HTML, có hỗ trợ ghi chú chân trang (footnotes).
*   **[Turndown](https://github.com/mixmark-io/turndown)**: Chuyển đổi ngược các định dạng HTML thành cú pháp Markdown.

### 4. Lưu Trữ Nội Bộ (Local Database & Storage)
*   **[idb (IndexedDB Wrapper)](https://github.com/jakearchibald/idb)**: Thư viện wrap IndexedDB, hỗ trợ xử lý các tác vụ liên quan đến IndexedDB tốt hơn. Toàn bộ dữ liệu sách được lưu cục bộ tại trình duyệt là thông qua IndexedDB.
