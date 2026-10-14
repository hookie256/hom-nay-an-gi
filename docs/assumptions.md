# Giả định, điểm cần xác nhận, mock data và API còn thiếu

## 1. Quyết định đã xác nhận với nhóm (“theo đề xuất”)

| # | Vấn đề trong tài liệu | Cách xử lý |
|---|---|---|
| 1 | Đánh giá mới “chờ kiểm duyệt” (UC37, 6.11), nhưng enum `moderationStatus` chỉ có `published` và `hidden` | Thêm giá trị `pending`. Đánh giá mới hoặc vừa sửa đều về `pending`. |
| 2 | Lọc theo chế độ ăn (FR17), nhưng `dishes` không có trường tương ứng | Thêm `dishes.dietCodes?`. Món chưa khai báo (`undefined`) bị coi là “không đủ dữ liệu” và bị loại khi người dùng lọc theo chế độ ăn. |
| 3 | UC32/UC62 nhắc tới hình minh họa và lưu ý của bước, nhưng `steps[]` không có hai trường này | Thêm `steps[].imageUrl?` và `steps[].note?`. |
| 4 | ER dùng `mealSlots`, đặc tả dùng `mealSlotIds`; ER của `orders` thiếu `paymentMethod`, `cancelRequest` | Theo bảng đặc tả (Bảng 5.4, 5.13). |
| 5 | Chưa quy định giờ của từng buổi | Sáng 05–10h, Trưa 10–14h, Chiều 14–17h, Tối 17–05h, múi giờ `Asia/Ho_Chi_Minh` (`src/domain/constants.ts`). |
| 6 | Chưa quy định trạng thái nào được hủy đơn | `pending`: người dùng hủy ngay. `confirmed`: gửi yêu cầu để quản trị viên duyệt. Từ `preparing` trở đi: không được hủy. |
| 7 | Chưa định nghĩa “phổ biến”, giới hạn số lượng, hình thức nhận | Phổ biến = lượt xem + lượt lưu trong 30 ngày. Mỗi món 1–20 phần (quản trị viên chỉnh được). Nhận món: giao tận nơi hoặc tự đến lấy. |
| 8 | `groupId` nguyên liệu không có collection quản lý | Danh sách nhóm cố định trong `INGREDIENT_GROUPS`. |
| 9 | Chưa có danh sách khẩu vị và chế độ ăn | Khẩu vị: cay, ngọt, chua, đậm đà, thanh đạm, béo. Chế độ ăn: chay, ít đường, ít dầu mỡ, không gluten. |

## 2. Giả định bổ sung trong lúc triển khai

- **Bộ lọc:**
  - Nhiều lựa chọn trong cùng một nhóm được hiểu là “thỏa ít nhất một” (6.6). Quy tắc này áp dụng cả cho chế độ ăn.
  - Món bị loại khi có nguyên liệu cần tránh ở bất kỳ vị trí nào, kể cả nguyên liệu tùy chọn.
- **Tìm “theo nguyên liệu” ở trang Khám phá (UC20):** trả về món có dùng **tất cả** các nguyên liệu đã chọn. Trang “Tìm món theo nguyên liệu” (UC16) thì xếp hạng theo tỷ lệ khớp.
- **Tìm kiếm tiếng Việt:** không phân biệt hoa/thường, bỏ dấu, gộp khoảng trắng (mục 5.9 yêu cầu thống nhất cách xử lý).
- **Trọng số gợi ý** 40/25/20/15 lấy theo ví dụ trong báo cáo, chưa được kiểm chứng. Khi thiếu tín hiệu thì chia lại trọng số cho các tín hiệu còn lại.
- **Thống kê:**
  - Lượt xem tổng hợp lưu ẩn danh trong `dish_view_stats`, tách khỏi lịch sử cá nhân (5.8.4). Đây là collection mới.
  - “Số người xem” chỉ đếm tài khoản đã bật lưu lịch sử.
- **Phiên đăng nhập:**
  - Phiên có hạn 2 giờ, tự gia hạn khi còn dưới 30 phút (UC04).
  - Đặt lại mật khẩu sẽ thu hồi mọi phiên cũ.
  - Liên kết đặt lại có hiệu lực 30 phút.
- **Phân quyền tài khoản:** admin thường chỉ khóa được tài khoản `user`. Khóa tài khoản quản trị cần `super_admin`.
- **Sửa món đã xuất bản:** nếu bản sửa làm công thức không còn đủ điều kiện, món tự chuyển về nháp (6.18: “phải được kiểm tra lại trước khi tiếp tục hiển thị công khai”).
- **Ẩn món** đồng thời tạm ngừng bán món đó.

## 3. Mock data

- Toàn bộ nằm trong `src/data/seed/`:
  - 22 danh mục (1 thẻ đã ẩn).
  - 19 đơn vị (1 đơn vị ngừng dùng).
  - Khoảng 70 nguyên liệu, có tên gọi khác, nhãn dị ứng và nguyên liệu thay thế.
  - 31 món: 29 đã xuất bản, 1 nháp thiếu bước nấu, 1 đã ẩn.
  - 10 món bán: 1 món tạm hết, 1 món có khung giờ riêng.
  - 5 tài khoản, 6 đơn ở nhiều trạng thái, đánh giá, báo cáo, sự kiện gợi ý và tìm kiếm.
- **Cảnh báo về công thức (GD01, RR01):** công thức và định lượng do nhóm phát triển tự soạn để chạy thử, **chưa được chuyên môn rà soát**.
  - Gia vị như nước mắm, dầu ăn đang đánh dấu là “bắt buộc”, nên tỷ lệ khớp nguyên liệu thấp hơn mong đợi. Quản trị viên nên xem lại.
- **Dinh dưỡng:** không có dữ liệu đã kiểm chứng nên để trống. Giao diện ghi “Chưa có dữ liệu” (RR11).
- **Ảnh món:** ảnh chụp thật lấy từ Wikimedia Commons (CC0 / public domain / CC BY / CC BY-SA), lưu ở `public/images/dishes/`. Tác giả và giấy phép hiển thị dưới ảnh ở trang chi tiết và liệt kê trong [image-credits.md](image-credits.md). 15 món chưa có ảnh đúng món trên Commons nên dùng ảnh món tương tự để minh họa; nên thay bằng ảnh tự chụp khi có. Hình minh họa tạo từ tên món vẫn được dùng khi món không có ảnh hoặc ảnh lỗi.

## 4. API và hạ tầng còn thiếu (cần backend thật)

| Hạng mục | Hiện trạng |
|---|---|
| Backend FastAPI + MongoDB (16 + 5 collection, chỉ mục ở mục 5.9) | Chưa có. Mock server trong `src/mock-server` mô tả đúng route và quy tắc để làm đặc tả. |
| Bảo mật thật: băm mật khẩu, quản lý phiên/token, kiểm tra quyền ở máy chủ | Mô phỏng. Chưa an toàn để dùng thật. |
| Gửi email đặt lại mật khẩu | Chưa có. Liên kết hiện trên màn hình ở chế độ mock. |
| Kho lưu ảnh và tải ảnh lên | Chưa có. Hiện chỉ nhập đường dẫn ảnh. |
| Cổng thanh toán trực tuyến (UC49) | Ngoài phạm vi (GD07). Lựa chọn bị vô hiệu hóa trên giao diện. |
| Giao món ngoài thực tế | Ngoài phạm vi. Website chỉ ghi nhận trạng thái do quản trị viên cập nhật. |
| Liên kết đơn hàng với lượt gợi ý (tỷ lệ đặt món sau gợi ý, FR48) | Chưa có. Hiển thị “Chưa có dữ liệu”. |
| Đo hiệu năng NFR01–02, sao lưu MongoDB NFR15 | Cần môi trường thật. |
| Thời hạn lưu dữ liệu sự kiện cá nhân (5.8.4, RR09) | Chưa quy định. |

## 5. Câu hỏi còn mở cho nhóm

1. Gia vị cơ bản (muối, nước mắm, dầu ăn) có nên tính vào “nguyên liệu bắt buộc” khi tính tỷ lệ khớp không? Hay nên coi là “sẵn có trong bếp”?
2. Có cần phí giao hàng hoặc giá trị đơn tối thiểu không?
3. Thời hạn lưu `activity_events` và `recommendation_events` là bao lâu?
4. Khi khóa tài khoản quản trị: admin thường có được khóa admin khác không? (Hiện tại: không.)
