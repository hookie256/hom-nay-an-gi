# Hôm Nay Ăn Gì?

Website gợi ý món ăn theo buổi, sở thích, nguyên liệu có sẵn và đặt món. Đây là phần giao diện ReactJS, xây dựng theo báo cáo *“Hệ thống hỗ trợ lựa chọn món ăn theo buổi, sở thích, nguyên liệu và đặt món”* (Nhóm 4, CNTT K20.1).

> **Lưu ý quan trọng:** báo cáo thiết kế backend **Python/FastAPI + MongoDB**, nhưng phần này **chưa được xây dựng**. Website đang chạy bằng một **máy chủ giả (mock server)** ngay trong trình duyệt:
> - Mock server mô phỏng đúng hợp đồng API ở mục 5.13 và các quy tắc nghiệp vụ.
> - Dữ liệu được lưu trong `localStorage` của trình duyệt.
> - Các kiểm tra quyền, giá, trạng thái **chỉ mô phỏng logic, không có giá trị bảo mật thật**.
>
> Xem [docs/assumptions.md](docs/assumptions.md).

## Yêu cầu

- Node.js ≥ 18 (đã chạy thử với Node 22)
- npm ≥ 9

## Cài đặt và chạy

```bash
npm install
```

```bash
npm run dev
```

Mở http://localhost:5173.

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy môi trường phát triển |
| `npm run build` | Kiểm tra kiểu TypeScript và build bản production vào `dist/` |
| `npm run preview` | Xem thử bản build |
| `npm run typecheck` | Chỉ kiểm tra kiểu TypeScript |
| `npm test` | Chạy unit test (logic nghiệp vụ và mock API) bằng Vitest |

### Biến môi trường (`.env.local`, xem `.env.example`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VITE_API_MODE` | `mock` | `mock`: dùng máy chủ giả; `http`: gọi backend thật |
| `VITE_API_BASE_URL` | `/api` | Địa chỉ backend khi `VITE_API_MODE=http` |
| `VITE_TIMEZONE` | `Asia/Ho_Chi_Minh` | Múi giờ để xác định buổi ăn mặc định |

## Tài khoản dùng thử (chỉ ở chế độ mock)

| Vai trò | Email | Mật khẩu | Ghi chú |
|---|---|---|---|
| Quản trị viên cấp cao | `super@homnayangi.test` | `Super@123` | Phân quyền, xem lịch sử quản trị, sao lưu dữ liệu thử |
| Quản trị viên | `admin@homnayangi.test` | `Admin@123` | |
| Người dùng | `an@homnayangi.test` | `User@123` | Có sở thích; tránh tôm; giỏ hàng có món đổi giá và món tạm hết |
| Người dùng | `binh@homnayangi.test` | `User@123` | Có đơn đang chờ duyệt hủy |
| Người dùng (bị khóa) | `khoa@homnayangi.test` | `User@123` | Dùng để kiểm thử “tài khoản bị khóa” |

- **Khôi phục dữ liệu mẫu:** đăng nhập super admin → *Quản trị → Sao lưu dữ liệu thử*, hoặc xóa `localStorage` key `hnag-mock-db`.
- **Quên mật khẩu:** chưa có dịch vụ gửi email, nên liên kết đặt lại mật khẩu được hiển thị ngay trên màn hình (chỉ ở chế độ mock).

## Cấu trúc thư mục

```
src/
  app/            router, layout (Public/Account/Admin), guard phân quyền
  components/
    ui/           design system: Button, Field/Input/Select, Modal, Toast, Tabs, Pagination, Alert, EmptyState…
    dish/         DishCard, DishImage, FavoriteButton, IngredientPicker
  contexts/       Auth, Cart, Catalog (danh mục dùng chung), Toast
  design/         tokens.css (màu, chữ, spacing, radius, shadow), base, components, app
  domain/         LOGIC NGHIỆP VỤ THUẦN (có unit test): thuật toán gợi ý, độ khớp nguyên liệu,
                  bộ lọc, khẩu phần, buổi ăn, kiểm tra xuất bản, trạng thái đơn, kiểm tra giỏ
  features/       các trang theo nhóm chức năng (home, ingredients, explore, dish, auth, account, cart, orders, admin)
  services/       lớp gọi API duy nhất (apiClient + service theo nhóm) – đổi sang backend thật chỉ cần đổi env
  mock-server/    máy chủ giả: CSDL localStorage, router, handler cho từng nhóm API, kiểm tra quyền
  data/seed/      dữ liệu mẫu: danh mục, đơn vị, 70 nguyên liệu, 31 món, tài khoản, đơn hàng, sự kiện
  types/          models.ts (theo Bảng 5.2–5.17), api.ts (hợp đồng API)
docs/
  traceability.md bảng đối chiếu FR01–FR51, NFR01–NFR23 với phần đã triển khai
  assumptions.md  giả định, điểm cần xác nhận, mock data, API còn thiếu
```

## Kết nối backend thật

1. Backend FastAPI cần cài đặt các route trong `src/services/index.ts`, theo đường dẫn và cấu trúc ở `src/types/api.ts`:
   - Lỗi trả về dạng `{ code, message, fieldErrors? }`.
   - Danh sách trả về dạng `{ items, page, pageSize, total, hasMore }`.
2. Xác thực bằng header `Authorization: Bearer <token>`.
3. Đặt `VITE_API_MODE=http` và `VITE_API_BASE_URL=https://.../api`.

Thư mục `src/mock-server/` có thể dùng làm đặc tả tham chiếu: mỗi handler ghi rõ use case và quy tắc mà nó thực hiện.

## Kiểm thử

- `npm test` chạy 71 test:
  - Logic nghiệp vụ: độ khớp nguyên liệu, thuật toán gợi ý, bộ lọc, khẩu phần, khung giờ bán, kiểm tra xuất bản, trạng thái đơn, kiểm tra giỏ.
  - Mock API: phân quyền, truy cập chéo, giá thay đổi, chống tạo đơn lặp, khóa tài khoản thu hồi phiên, không xóa dữ liệu đang được tham chiếu…
- Đã kiểm tra thủ công trên trình duyệt ở desktop và mobile (375px). Chi tiết ở [docs/traceability.md](docs/traceability.md).
