import { ButtonLink, EmptyState } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/misc';

export function NotFoundPage() {
  useDocumentTitle('Không tìm thấy trang');
  return (
    <div className="container page">
      <EmptyState icon="search" title="Không tìm thấy trang" action={<ButtonLink to="/" variant="primary">Về trang chủ</ButtonLink>}>
        Đường dẫn có thể đã thay đổi hoặc không tồn tại.
      </EmptyState>
    </div>
  );
}
