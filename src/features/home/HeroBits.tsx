import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DishCard } from '@/types/api';
import { Button, Icon } from '@/components/ui';
import { DishImage } from '@/components/dish/DishImage';
import { formatMinutes } from '@/utils/format';

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Tiêu đề “Hôm nay ăn …?” với tên món đổi liên tục. */
export function RotatingWord({ words, interval = 2400 }: { words: string[]; interval?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (words.length < 2 || prefersReducedMotion()) return;
    const t = setInterval(() => setI((x) => (x + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words, interval]);
  useEffect(() => setI(0), [words]);
  const word = words[i] ?? 'gì';
  return (
    <span className="rotating" aria-hidden>
      <span key={word} className="rotating__word">{word.toLowerCase()}?</span>
    </span>
  );
}

/** Chồng ảnh món tự lướt – bấm để mở món. */
export function HeroDeck({ dishes, recId }: { dishes: DishCard[]; recId?: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const list = dishes.slice(0, 5);
  useEffect(() => setActive(0), [dishes]);
  useEffect(() => {
    if (paused || list.length < 2 || prefersReducedMotion()) return;
    const t = setInterval(() => setActive((a) => (a + 1) % list.length), 3200);
    return () => clearInterval(t);
  }, [paused, list.length]);

  if (list.length === 0) return <div className="deck deck--empty" aria-hidden />;
  return (
    <div className="deck" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {list.map((d, idx) => {
        const pos = (idx - active + list.length) % list.length;
        return (
          <Link
            key={d._id}
            to={`/mon/${d.slug}${recId ? `?rec=${recId}` : ''}`}
            className="deck__card"
            data-pos={pos}
            tabIndex={pos === 0 ? 0 : -1}
            aria-hidden={pos !== 0}
            aria-label={pos === 0 ? `Xem món ${d.name}` : undefined}
          >
            <DishImage src={d.image} name={d.name} className="deck__img" eager={idx < 2} />
            <span className="deck__info">
              <strong>{d.name}</strong>
              <span><Icon name="clock" size={13} /> {formatMinutes(d.totalMinutes)}</span>
            </span>
          </Link>
        );
      })}
      <div className="deck__dots" role="tablist" aria-label="Chọn món đang hiển thị">
        {list.map((d, idx) => (
          <button key={d._id} type="button" role="tab" aria-selected={idx === active} aria-label={d.name} className="deck__dot" onClick={() => setActive(idx)} />
        ))}
      </div>
    </div>
  );
}

/** “Chọn giúp tôi”: lướt nhanh qua các món đang gợi ý rồi dừng ở một món. */
export function SpinPicker({ dishes, onPicked }: { dishes: DishCard[]; onPicked: (d: DishCard) => void }) {
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState<DishCard | null>(null);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const spin = () => {
    if (dishes.length === 0 || spinning) return;
    const target = Math.floor(Math.random() * dishes.length);
    if (prefersReducedMotion()) {
      setShown(dishes[target]);
      onPicked(dishes[target]);
      return;
    }
    setSpinning(true);
    const total = dishes.length * 3 + target;
    let step = 0;
    const tick = () => {
      setShown(dishes[step % dishes.length]);
      if (step >= total) {
        setSpinning(false);
        onPicked(dishes[target]);
        return;
      }
      step++;
      // chậm dần như máy quay số
      timer.current = window.setTimeout(tick, 50 + (step / total) ** 3 * 380);
    };
    tick();
  };

  return (
    <div className="spin">
      <Button variant="primary" size="lg" icon="sparkles" onClick={spin} disabled={dishes.length === 0} loading={spinning}>
        {spinning ? 'Đang chọn…' : 'Chọn giúp tôi'}
      </Button>
      <span className={['spin__result', spinning && 'spin__result--rolling'].filter(Boolean).join(' ')} aria-live="polite">
        {shown ? <>{spinning ? '' : 'Hôm nay ăn '}<strong>{shown.name}</strong>{spinning ? '' : ' nhé!'}</> : 'Phân vân quá? Để hệ thống chọn một món trong danh sách gợi ý.'}
      </span>
    </div>
  );
}

/** Dải ảnh món chạy ngang vô tận, dừng khi di chuột vào. */
export function DishMarquee({ dishes }: { dishes: DishCard[] }) {
  const withImg = dishes.filter((d) => d.image);
  if (withImg.length < 4) return null;
  const loop = [...withImg, ...withImg];
  return (
    <section className="marquee" aria-label="Một số món trên Hôm Nay Ăn Gì?">
      <div className="marquee__track">
        {loop.map((d, i) => (
          <Link key={`${d._id}-${i}`} to={`/mon/${d.slug}`} className="marquee__item" tabIndex={i < withImg.length ? 0 : -1} aria-hidden={i >= withImg.length}>
            <img src={d.image} alt="" loading="lazy" />
            <span>{d.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
