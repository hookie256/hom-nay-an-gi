/** Cấu hình server – đọc từ biến môi trường (xem .env.example). */
export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/?directConnection=true',
  dbName: process.env.MONGODB_DB ?? 'hom_nay_an_gi',
  production: process.env.NODE_ENV === 'production',
  /** Hiện liên kết đặt lại mật khẩu trong phản hồi (chưa có dịch vụ email). Tắt ở production. */
  exposeResetLink: (process.env.EXPOSE_RESET_LINK ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true',
};
