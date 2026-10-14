import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { favoriteService } from '@/services';

/** Lưu/bỏ lưu món (UC34, UC35). Khách được dẫn đến đăng nhập rồi quay lại. */
export function FavoriteButton({ dishId, dishName, initial, size = 'md', withLabel, onChange }: {
  dishId: string; dishName: string; initial: boolean; size?: 'sm' | 'md'; withLabel?: boolean; onChange?: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);

  if (user && user.role !== 'user') return null;

  const toggle = async () => {
    if (!user) {
      navigate(`/dang-nhap?next=${encodeURIComponent(location.pathname + location.search)}`, { state: { reason: 'Đăng nhập để lưu món yêu thích.' } });
      return;
    }
    setBusy(true);
    try {
      if (fav) await favoriteService.remove(dishId);
      else await favoriteService.add(dishId);
      setFav(!fav);
      onChange?.(!fav);
      toast.success(fav ? `Đã bỏ lưu “${dishName}”.` : `Đã lưu “${dishName}” vào món yêu thích.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const label = fav ? `Bỏ lưu ${dishName}` : `Lưu ${dishName} vào yêu thích`;
  return (
    <Button
      variant={fav ? 'soft' : withLabel ? 'secondary' : 'ghost'}
      size={size}
      iconOnly={!withLabel}
      icon="heart"
      onClick={toggle}
      loading={busy}
      aria-pressed={fav}
      aria-label={withLabel ? undefined : label}
      title={label}
      className={['fav-btn', fav && 'fav-btn--on'].filter(Boolean).join(' ')}
    >
      {withLabel ? (fav ? 'Đã lưu' : 'Lưu món') : null}
    </Button>
  );
}
