# 1987-Layout

Dịch file PDF dài từ tiếng Anh sang tiếng Việt. Có khả năng giữ lại ảnh & công thức toán.

- Link app: https://aistudio.google.com/apps/9333e4c6-6b7a-442a-80ad-7b0a263c44ff?showPreview=true&showAssistant=true&fullscreenApplet=true (sử dụng được Key miễn phí để dịch);
- Link web: https://1987-layout.wpsila.com/ (Key trả phí mới dùng được);

Chất lượng của 2 bản trên như nhau, chỉ khác là bản trên AI Studio thì tận dụng được API Key miễn phí của Gemini.

---

Ý tưởng của dự án này được phát triển dựa trên 2 dự án trước đó:
- silaBook: https://github.com/kiencang/silaBook
- PDF-silaTranslator-Online: https://github.com/kiencang/PDF-silaTranslator-Online

Nó cố gắng tận dụng 2 ưu điểm các các dự án trước là khả năng dịch dài và khả năng bảo toàn định dạng tốt của bản gốc.

Lưu ý là mặc dù có nhiều điểm tương đồng 1987-Layout và silaBook không thay thế nhau hoàn toàn và không có cái nào `tốt hơn hẳn`. Bạn dùng công cụ nào sẽ tùy trường hợp cụ thể và mục đích.

## Hướng dẫn sử dụng
Về cơ bản ứng dụng 1987-Layout cũng có cách sử dụng khá tương đồng với silaBook. 
- **Bước 1**: Nhập tên sách và tên tác giả. Nhập chính xác tên sách & tác giả giúp công cụ dịch tốt hơn;
- **Bước 2**: Chia sách thành các phần nhỏ. Đây là điểm khác biệt lớn nhất với silaBook. Với 1987-Layout, hiện chúng ta chia đều sách thành các mốc cố định, mặc định là 20 trang một phần, và ngưỡng điều chỉnh là 10 - 25 trang. Chia nhỏ hơn 10 sách sẽ quá vụn, còn lớn hơn 25 khả năng vượt qua ngưỡng phản hồi của AI sẽ tăng lên (Gemini hiện chỉ cho phép trả về 65 ngàn token kết quả đầu ra);
- **Bước 3**: Nhận diện Đại từ. Vì 1987-Layout tập trung vào sách khoa học, phần này có thể bỏ qua và không quan trọng lắm. Tuy nhiên ứng dụng vẫn giữ lại, vì có một số dạng sách khoa học vẫn tồn tại ở dạng chuyện kể, với kiểu trình bày này, đại từ có thể vẫn có nhiều và phong phú;
- **Bước 4**: Nhận diện Thuật ngữ/Từ khó. Một mục quan trọng đối với thể loại sách khoa học, và chắc chắn bạn cần triển khai;
- **Bước 5**: Dịch, mặc định công cụ sử dụng model Pro để dịch. Model này mạnh hơn Flash về khả năng xử lý chính xác, do vậy quan trọng để đảm bảo kết quả dịch tốt hơn, do đầu vào là PDF tương đối phức tạp (đầu vào của silaBook là dạng markdown, đơn giản hơn và có thể dùng Flash vẫn có chất lượng tượng đối tốt). Ngoài ra ở bước này bạn có thể chọn `Phong cách dịch`, có 3 phong cách cơ bản, mặc định là `Khoa học nói chung`, nó phù hợp với hầu hết các tài liệu khoa học có công thức toán. Với tài liệu nào có dạng toán học phức tạp, gồm cả sơ đồ, biểu đồ toán nên chọn phong cách dịch `Toán chuyên ngành`, còn tài liệu nào đơn thuần là dạng báo cáo, không sử dụng công thức toán phức tạp trong trình bày hãy sử dụng phong cách `Khoa học xã hội`;

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
*   **[JSZip](https://stuk.github.io/jszip/)**: Công cụ nén & đóng gói toàn bộ file HTML thành file .zip hoàn chỉnh để tải về.

### 4. Lưu Trữ Nội Bộ (Local Database & Storage)
*   **[idb (IndexedDB Wrapper)](https://github.com/jakearchibald/idb)**: Thư viện wrap IndexedDB, hỗ trợ xử lý các tác vụ liên quan đến IndexedDB tốt hơn. Toàn bộ dữ liệu sách được lưu cục bộ tại trình duyệt là thông qua IndexedDB.
