# Ảnh chụp mã nguồn tầng truy cập cơ sở dữ liệu

Dự án không có lớp DAO riêng theo từng bảng. Các handler nghiệp vụ (`src/mock-server/handlers/`) làm việc trên một đối tượng `DbState`, còn tầng lưu trữ bên dưới đọc/ghi trạng thái đó vào MongoDB (server Node) hoặc `localStorage` (chế độ mock).

## MongoDB (server Node)

| Ảnh | File | Nội dung |
|---|---|---|
| [01-mongostore-anh-xa-bson.png](01-mongostore-anh-xa-bson.png) | `server/mongoStore.ts` dòng 1–60 | Danh sách collection, ánh xạ chuỗi hex ⇄ `ObjectId`, chuỗi ISO ⇄ `Date` |
| [02-mongostore-doc-ghi.png](02-mongostore-doc-ghi.png) | `server/mongoStore.ts` dòng 61–117 | `loadState` đọc mọi collection; `persistDiff` chỉ ghi document thay đổi bằng `bulkWrite`; `writeFullState` khi seed |
| [03-mongostore-chi-muc.png](03-mongostore-chi-muc.png) | `server/mongoStore.ts` dòng 118–152 | `ensureIndexes`: chỉ mục unique, tìm kiếm món, lịch sử, đơn hàng |
| [04-server-ket-noi-transaction.png](04-server-ket-noi-transaction.png) | `server/index.ts` dòng 51–104 | Kết nối `MongoClient`, mỗi yêu cầu API chạy trong `session.withTransaction` |
| [05-seed-du-lieu-mau.png](05-seed-du-lieu-mau.png) | `server/seed.ts` | Nạp dữ liệu mẫu (`npm run db:seed`, `npm run db:reset`) |
| [06-cau-hinh-ket-noi.png](06-cau-hinh-ket-noi.png) | `server/config.ts` | Chuỗi kết nối `MONGODB_URI`, tên CSDL `MONGODB_DB` |

## localStorage (chế độ mock trong trình duyệt)

| Ảnh | File | Nội dung |
|---|---|---|
| [07-mock-db-cau-truc.png](07-mock-db-cau-truc.png) | `src/mock-server/db.ts` dòng 1–49 | Kiểu `DbState` (các collection), khóa lưu trữ |
| [08-mock-db-luu-tai.png](08-mock-db-luu-tai.png) | `src/mock-server/db.ts` dòng 50–134 | Tạo dữ liệu mẫu, `loadDb`/`saveDb`, sao lưu, khôi phục |
