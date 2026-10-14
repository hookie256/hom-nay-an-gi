import { forwardRef, useEffect, useState } from 'react';
import type { DishDetail } from '@/types/api';
import { Button, Checkbox, Icon } from '@/components/ui';
import { formatMinutes } from '@/utils/format';

/**
 * UC32–UC33: các bước nấu đúng thứ tự + chế độ “Nấu theo từng bước”.
 * Tiến độ chỉ lưu tạm trên thiết bị đang dùng; khóa lưu gắn với phiên bản công thức để không ghép
 * tiến độ của hai phiên bản (6.9).
 */
export const StepsSection = forwardRef<HTMLElement, { dish: DishDetail }>(function StepsSection({ dish }, ref) {
  const storageKey = `hnag-progress-${dish._id}-${dish.updatedAt}`;
  const steps = [...dish.steps].sort((a, b) => a.stepNo - b.stepNo);
  const [done, setDone] = useState<number[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
    } catch {
      return [];
    }
  });
  const [cooking, setCooking] = useState(false);
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(done));
    } catch {
      /* bỏ qua */
    }
  }, [done, storageKey]);

  const toggle = (no: number) => setDone((d) => (d.includes(no) ? d.filter((x) => x !== no) : [...d, no]));
  const allDone = done.length === steps.length && steps.length > 0;
  const step = steps[current];

  return (
    <section ref={ref} className="card card__body stack" aria-labelledby="steps-title" id="cach-nau" tabIndex={-1}>
      <div className="row-between">
        <h2 id="steps-title" className="h3" style={{ margin: 0 }}>Cách nấu</h2>
        <div className="row">
          {done.length > 0 && <Button size="sm" variant="ghost" onClick={() => { setDone([]); setCurrent(0); }}>Làm lại từ đầu</Button>}
          <Button size="sm" variant={cooking ? 'soft' : 'accent'} icon={cooking ? 'list' : 'play'} onClick={() => setCooking((c) => !c)} aria-pressed={cooking}>
            {cooking ? 'Xem tất cả bước' : 'Nấu theo từng bước'}
          </Button>
        </div>
      </div>
      <p className="subtle">Tiến độ chỉ lưu tạm trên thiết bị này và chưa được đồng bộ. Thời gian mỗi bước là ước tính.</p>
      <div className="meter" aria-hidden><div className="meter__bar" style={{ width: `${(done.length / Math.max(steps.length, 1)) * 100}%` }} /></div>
      <p className="small muted" aria-live="polite">Đã hoàn thành {done.length}/{steps.length} bước</p>

      {cooking && step ? (
        <div className="cook-mode">
          <div className="cook-mode__step" aria-live="polite">
            <div className="cook-mode__no">Bước {step.stepNo}/{steps.length}</div>
            <h3>{step.title}</h3>
            <p className="cook-mode__text">{step.instruction}</p>
            {step.durationMinutes !== undefined && <p className="muted"><Icon name="clock" size={15} /> Khoảng {formatMinutes(step.durationMinutes)}</p>}
            {step.note && <p className="step-note"><Icon name="info" size={15} /> {step.note}</p>}
            {step.imageUrl && <img src={step.imageUrl} alt={`Minh họa bước ${step.stepNo}`} className="step-img" />}
            <Checkbox label="Đã làm xong bước này" checked={done.includes(step.stepNo)} onChange={() => toggle(step.stepNo)} />
          </div>
          <div className="row-between">
            <Button icon="chevronLeft" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0}>Bước trước</Button>
            {current < steps.length - 1 ? (
              <Button variant="primary" iconRight="chevronRight" onClick={() => { if (!done.includes(step.stepNo)) toggle(step.stepNo); setCurrent((c) => c + 1); }}>Bước tiếp theo</Button>
            ) : (
              <Button variant="accent" icon="check" onClick={() => !done.includes(step.stepNo) && toggle(step.stepNo)}>Hoàn thành</Button>
            )}
          </div>
          {allDone && <div className="alert alert--success" role="status"><Icon name="checkCircle" /> Bạn đã hoàn thành tất cả các bước. Chúc ngon miệng!</div>}
        </div>
      ) : (
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.stepNo} className={['step', done.includes(s.stepNo) && 'step--done'].filter(Boolean).join(' ')}>
              <span className="step__no" aria-hidden>{done.includes(s.stepNo) ? <Icon name="check" size={16} /> : s.stepNo}</span>
              <div className="step__body">
                <h3 className="h4">{s.title}{s.durationMinutes !== undefined && <span className="subtle"> · {formatMinutes(s.durationMinutes)}</span>}</h3>
                <p>{s.instruction}</p>
                {s.note && <p className="step-note"><Icon name="info" size={15} /> {s.note}</p>}
                {s.imageUrl && <img src={s.imageUrl} alt={`Minh họa bước ${s.stepNo}`} className="step-img" loading="lazy" />}
                <Checkbox label="Đã làm" checked={done.includes(s.stepNo)} onChange={() => toggle(s.stepNo)} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
});
