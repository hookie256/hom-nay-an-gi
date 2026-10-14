# Bảng đối chiếu yêu cầu và kết quả triển khai

**Chú thích trạng thái:**
- ✅ Đã triển khai: chạy được trên giao diện và mock API.
- ⚠️ Một phần, hoặc phụ thuộc backend thật.
- ❌ Chưa triển khai.

**Chú thích cột “Kiểm tra”:**
- **UT**: unit test logic nghiệp vụ (`src/domain/domain.test.ts`).
- **API**: test mock API (`src/mock-server/mockServer.test.ts`).
- **TC**: kiểm tra thủ công trên trình duyệt trong phiên này.

## Yêu cầu chức năng (FR01–FR51)

| Mã | Yêu cầu | Nơi triển khai | Trạng thái | Kiểm tra |
|---|---|---|---|---|
| FR01 | Đăng ký, kiểm tra dữ liệu | `/dang-ky` · `POST /auth/register` | ✅ | API (email trùng) |
| FR02 | Đăng nhập, đăng xuất, làm mới phiên, đặt lại mật khẩu | `/dang-nhap`, menu tài khoản, `/quen-mat-khau`, `/dat-lai-mat-khau`; phiên tự gia hạn khi còn < 30 phút (UC04) | ⚠️ Email đặt lại mật khẩu chưa gửi thật (liên kết hiện trên màn hình ở chế độ mock) | API, TC |
| FR03 | Kiểm tra vai trò, trạng thái, quyền | `requireUser/requireRole` (mock-server/helpers.ts), `RequireAuth` | ⚠️ Logic đúng, nhưng chỉ an toàn khi chạy ở máy chủ thật | API |
| FR04 | Xem/cập nhật hồ sơ | `/tai-khoan/ho-so` | ✅ | TC |
| FR05 | Sở thích: món, danh mục, khẩu vị, ẩm thực | Hồ sơ → “Sở thích ăn uống”; món yêu thích dùng làm tín hiệu | ✅ | TC |
| FR06 | Chế độ ăn, nguyên liệu cần tránh, thời gian nấu | Hồ sơ → các mục tương ứng | ✅ | UT |
| FR07 | Gợi ý theo buổi hiện tại | Trang chủ, `POST /recommendations` | ✅ | UT, TC |
| FR08 | Chọn buổi thủ công | Nhóm nút Sáng/Trưa/Chiều/Tối | ✅ | TC |
| FR09 | Đổi món, hạn chế lặp món vừa bỏ qua | “Đổi món khác” · `POST /recommendations/:id/replace` | ✅ | UT, API, TC |
| FR10 | Lý do gợi ý dựa trên dữ liệu thực | “Vì sao gợi ý món này?” | ✅ | UT, TC |
| FR11 | Thêm/xóa nguyên liệu đang có | `/nguyen-lieu`, IngredientPicker (không trùng, tìm bằng tên gọi khác) | ✅ | TC |
| FR12 | Tìm và xếp hạng theo nguyên liệu | `computeIngredientMatch`, `recommend` | ✅ | UT, TC |
| FR13 | Hiển thị đã có / còn thiếu / mức phù hợp | Thẻ kết quả: thanh % và chi tiết | ✅ | UT, TC |
| FR14 | Danh sách công khai, phân trang/tải thêm | `/kham-pha`, “Xem thêm món” | ✅ | API |
| FR15 | Tìm theo tên và nguyên liệu | `/kham-pha`: chuyển “Tên món / Nguyên liệu” | ✅ | UT |
| FR16 | Món mới, phổ biến, sắp xếp | Tab trên trang chủ; menu Sắp xếp | ✅ | UT |
| FR17 | Kết hợp bộ lọc | Bộ lọc: buổi, loại món, thẻ, ẩm thực, thời gian, độ khó, khẩu vị, chế độ ăn | ✅ | UT |
| FR18 | Loại trừ nguyên liệu, xóa bộ lọc | “Loại trừ nguyên liệu”, nhãn bộ lọc, “Xóa tất cả”; tự áp dụng nguyên liệu cần tránh từ hồ sơ | ✅ | UT |
| FR19 | Chi tiết món | `/mon/:slug` | ✅ | TC |
| FR20 | Món liên quan | Mục “Món liên quan” (ẩn nếu không có) | ✅ | TC |
| FR21 | Phân biệt xem cách nấu / đặt món | Hai nút riêng; “Đặt món” chỉ hiện khi đang nhận đơn | ✅ | TC |
| FR22 | Nguyên liệu, định lượng, đơn vị, sơ chế | IngredientsSection | ✅ | TC |
| FR23 | Điều chỉnh theo khẩu phần | Bộ tăng/giảm khẩu phần; làm tròn theo đơn vị | ✅ | UT, TC |
| FR24 | Nguyên liệu thay thế đã khai báo | Nút “Thay thế” kèm ghi chú và cảnh báo | ✅ | TC |
| FR25 | Các bước đúng thứ tự | StepsSection | ✅ | TC |
| FR26 | Đánh dấu tiến độ, chuyển bước | “Nấu theo từng bước”; tiến độ lưu tạm trên thiết bị (sessionStorage) | ✅ | TC |
| FR27 | Thêm/bỏ/tìm yêu thích | Nút trái tim; `/tai-khoan/yeu-thich` | ✅ | TC |
| FR28 | Tạo/sửa/xóa đánh giá của mình | ReviewsSection; đánh giá mới/sửa chờ duyệt | ✅ | TC |
| FR29 | Đánh giá công khai, báo cáo nhận xét | Danh sách phân trang; “Báo cáo” chống trùng | ✅ | TC |
| FR30 | Lưu và xem lịch sử | `/tai-khoan/lich-su`; chỉ ghi khi bật `saveHistory` | ✅ | TC |
| FR31 | Xóa lịch sử | Xóa từng mục hoặc toàn bộ (có xác nhận) | ✅ | TC |
| FR32 | Thêm món đang bán vào giỏ | Khối “Đặt món” | ✅ | API, TC |
| FR33 | Đổi số lượng, xóa, tạm tính | `/gio-hang` | ✅ | TC |
| FR34 | Kiểm tra lại giá, trạng thái, số lượng trước khi đặt | `validateCart`; cảnh báo kèm “Đồng ý giá mới” / “Bỏ món không đặt được” | ✅ | UT, API, TC |
| FR35 | Thông tin nhận món, tạo đơn có mã riêng | `/dat-hang` → `/dat-hang/thanh-cong/:id` | ✅ | API, TC |
| FR36 | Thanh toán khi nhận món; trực tuyến nếu tích hợp | COD đầy đủ; trực tuyến hiển thị “chưa tích hợp” | ⚠️ Thanh toán trực tuyến ngoài phạm vi (GD07) | API |
| FR37 | Xem đơn, theo dõi, yêu cầu hủy | `/tai-khoan/don-hang`, chi tiết có dòng thời gian | ✅ | API |
| FR38 | Thêm/sửa/xuất bản/ẩn/xóa món | `/admin/mon-an`, `/admin/mon-an/:id` | ✅ | API, TC |
| FR39 | Kiểm tra đầy đủ trước khi xuất bản | “Kiểm tra công thức”, chặn xuất bản kèm lỗi theo trường | ✅ | UT, API, TC |
| FR40 | Nguyên liệu, nhóm, đơn vị, thay thế | `/admin/nguyen-lieu`, `/admin/don-vi` | ✅ | API |
| FR41 | Định lượng và các bước | Trình chỉnh sửa công thức (thêm, sắp xếp lại bước) | ✅ | TC |
| FR42 | Danh mục buổi, loại món, ẩm thực, thẻ | `/admin/danh-muc` (ẩn kèm cảnh báo số món đang dùng) | ✅ | TC |
| FR43 | Tìm tài khoản, khóa/mở, phân quyền | `/admin/tai-khoan` | ✅ | API |
| FR44 | Lưu/xem lịch sử quản trị | `admin_audit_logs`; `/admin/nhat-ky` (chỉ super_admin) | ✅ | API, TC |
| FR45 | Duyệt/ẩn đánh giá, xử lý báo cáo | `/admin/danh-gia` | ✅ | TC |
| FR46 | Thống kê theo khoảng thời gian | `/admin` | ✅ | TC |
| FR47 | Món, từ khóa, nguyên liệu nổi bật | `/admin` | ✅ | TC |
| FR48 | Tỷ lệ gợi ý dẫn đến mở/chọn món | `/admin` → “Hiệu quả gợi ý”, có định nghĩa mẫu số | ⚠️ Tỷ lệ đặt món sau gợi ý hiển thị “Chưa có dữ liệu” vì chưa liên kết đơn hàng với lượt gợi ý | API |
| FR49 | Giá và trạng thái bán | `/admin/thuc-don-ban` (xem trước trước khi áp dụng) | ✅ | TC |
| FR50 | Thời gian nhận đơn | “Thời gian nhận đơn” (mặc định) và khung giờ riêng từng món | ✅ | UT |
| FR51 | Tiếp nhận/xác nhận/từ chối/cập nhật/hủy đơn | `/admin/don-hang`; ghi nhận thu tiền và hoàn tiền | ✅ | UT, API, TC |

## Yêu cầu phi chức năng (NFR01–NFR23)

| Mã | Nội dung | Kết quả |
|---|---|---|
| NFR01–02 | Thời gian ≤ 3 giây | ⚠️ Chưa đo trên hệ thống thật. Mock có độ trễ giả 150–350 ms; bản build JS khoảng 123 KB gzip. Cần đo lại khi có backend (GD08). |
| NFR03 | Phân trang | ✅ Mọi danh sách đều phân trang (tối đa 50 mục mỗi lần). |
| NFR04 | Mở rộng dữ liệu không đổi luồng chính | ✅ Thêm món/nguyên liệu qua trang quản trị. |
| NFR05 | Không lưu/trả mật khẩu dạng đọc được | ⚠️ Mock băm SHA-256 có salt và không trả `passwordHash` (đã test). Backend thật cần dùng bcrypt/argon2. |
| NFR06–08 | Kiểm tra phiên, quyền sở hữu và quyền quản trị tại máy chủ | ⚠️ Đã cài đặt trong mock và có test, nhưng chỉ có hiệu lực bảo mật khi chuyển sang backend thật. |
| NFR09 | Xóa lịch sử | ✅ |
| NFR10 | Nhật ký thao tác quản trị | ✅ Ghi cho món, nguyên liệu, đơn vị, danh mục, tài khoản, đánh giá, thực đơn, đơn hàng, thiết lập. |
| NFR11 | Không tạo đơn thiếu dữ liệu | ✅ (API test) |
| NFR12 | Giữ giá đã chốt | ✅ Snapshot `snapshotName`, `unitPrice` (API test với đơn cũ 40.000 đ). |
| NFR13 | Chuyển trạng thái đúng trình tự | ✅ (UT + API) |
| NFR14 | Lỗi không ghi nhận thành công sai | ✅ Mock khôi phục toàn bộ trạng thái nếu handler lỗi; giao diện chỉ cập nhật theo phản hồi thành công. |
| NFR15 | Sao lưu/khôi phục | ⚠️ Chế độ mock: xuất/nhập JSON ở `/admin/du-lieu`. Backend thật cần mongodump/mongorestore. |
| NFR16 | Dễ tìm gợi ý theo buổi và theo nguyên liệu từ trang chủ | ✅ Phần đầu trang chủ và menu chính. |
| NFR17 | Thẻ món có tên, ảnh, thời gian, lý do | ✅ |
| NFR18 | Thông báo rõ khi không có kết quả | ✅ Nêu điều kiện gây rỗng và giữ nguyên bộ lọc. |
| NFR19 | Dùng được trên máy tính và điện thoại | ✅ Đã đo ở 375px: không trang nào tràn ngang. |
| NFR20 | Nhãn trường, lỗi cạnh trường | ✅ Component `Field` gắn `aria-invalid` và `aria-describedby`; đã kiểm tra trên trang đăng nhập và đặt hàng. |
| NFR21 | Thêm món qua giao diện quản trị | ✅ |
| NFR22 | Nguyên liệu/đơn vị thống nhất | ✅ Tham chiếu bằng ID; tìm không dấu và theo tên gọi khác. |
| NFR23 | Ghi lỗi, không lộ thông tin kỹ thuật | ✅ Lỗi 500 trả thông điệp chung; chi tiết chỉ ghi ra console. |

## Accessibility đã áp dụng

- Có liên kết “Bỏ qua đến nội dung chính”.
- Dùng HTML ngữ nghĩa (`main`, `nav`, `section`, `aria-labelledby`).
- Modal có bẫy focus, đóng bằng Esc và trả focus về chỗ cũ.
- Tabs, nhóm nút chọn buổi và ô chọn nguyên liệu (combobox) điều hướng được bằng phím mũi tên.
- Màu chữ đạt tương phản ≥ 4.5:1.
- Tôn trọng thiết lập `prefers-reduced-motion`.
