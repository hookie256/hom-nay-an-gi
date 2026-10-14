import { useState } from 'react';

const PALETTES = [
  ['#fde3cf', '#f4a46a'], ['#e3f1e6', '#8cc39c'], ['#fbe2e0', '#ee9a8f'], ['#fff1c9', '#f0c35a'],
  ['#e5eefb', '#8fb2e3'], ['#efe6fa', '#b79ad8'], ['#f9e4cc', '#d9a066'],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Ảnh món. Tài liệu chưa cung cấp ảnh nên khi thiếu ảnh hoặc ảnh lỗi sẽ dùng hình minh họa
 * tạo từ tên món (không giả làm ảnh thật).
 */
export function DishImage({ src, name, className, eager }: { src?: string; name: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt={name} className={className} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} />;
  }
  const [bg, fg] = PALETTES[hash(name) % PALETTES.length];
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className={['dish-placeholder', className].filter(Boolean).join(' ')} style={{ background: `linear-gradient(135deg, ${bg}, ${fg})` }} role="img" aria-label={`Hình minh họa: ${name}`}>
      <svg viewBox="0 0 120 80" width="46%" aria-hidden>
        <ellipse cx="60" cy="50" rx="46" ry="16" fill="rgba(255,255,255,.65)" />
        <path d="M18 46a42 22 0 0 0 84 0z" fill="rgba(255,255,255,.9)" />
        <path d="M46 30c0-6 6-6 6-12M60 30c0-6 6-6 6-12M74 30c0-6 6-6 6-12" stroke="rgba(255,255,255,.85)" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      <span className="dish-placeholder__text" aria-hidden>{initials}</span>
    </div>
  );
}
