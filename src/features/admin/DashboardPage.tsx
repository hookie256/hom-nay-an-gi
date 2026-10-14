import { useState } from 'react';
import { Alert, ErrorState, Field, Input, Loading, PageHeader } from '@/components/ui';
import { adminService } from '@/services';
import { useQuery } from '@/hooks/useQuery';
import { useDocumentTitle } from '@/hooks/misc';
import { formatPrice, isoDay } from '@/utils/format';

/** UC74–UC76: tổng quan, món/từ khóa nổi bật, hiệu quả gợi ý – mỗi chỉ số có định nghĩa rõ. */
export function DashboardPage() {
  useDocumentTitle('Thống kê');
  const today = new Date();
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 29 * 86400000)));
  const [to, setTo] = useState(isoDay(today));
  const invalid = from > to;
  const q = useQuery(async () => {
    const [overview, top, rec] = await Promise.all([adminService.statsOverview(from, to), adminService.statsTop(from, to), adminService.statsRecommendation(from, to)]);
    return { overview, top, rec };
  }, [from, to], { enabled: !invalid });

  const o = q.data?.overview;
  const maxDaily = Math.max(1, ...(o?.daily.map((d) => Math.max(d.views, d.recommendations)) ?? [1]));
  const pct = (v: number | null) => (v === null ? 'Chưa có dữ liệu' : `${v.toLocaleString('vi-VN')}%`);

  return (
    <div className="stack">
      <PageHeader title="Thống kê" description="Số liệu tổng hợp theo khoảng thời gian. Lượt (số lần) khác với số người." actions={
        <div className="row">
          <Field label="Từ ngày"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Đến ngày"><Input type="date" value={to} min={from} max={isoDay(today)} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      } />
      {invalid && <Alert tone="danger">Ngày bắt đầu phải trước ngày kết thúc.</Alert>}
      {q.loading && !q.data ? <Loading /> : q.error ? <ErrorState message={q.error.message} onRetry={q.reload} /> : o && q.data && (
        <>
          <div className="kpi-grid">
            <Kpi label="Tài khoản" value={o.totalUsers} hint={`${o.newUsers} tài khoản mới trong kỳ`} />
            <Kpi label="Món đã xuất bản" value={o.publishedDishes} hint={`Tổng ${o.totalDishes} món (gồm nháp, đã ẩn)`} />
            <Kpi label="Lượt xem món" value={o.dishViews} hint={`Số lần mở trang chi tiết. ${o.distinctViewers} tài khoản khác nhau (chỉ tính người bật lưu lịch sử).`} />
            <Kpi label="Lượt gợi ý" value={o.recommendations} hint="Một lần yêu cầu gợi ý = một lượt, dù trả về nhiều món." />
            <Kpi label="Đơn hàng" value={o.orders} hint={`${o.completedOrders} đơn hoàn thành`} />
            <Kpi label="Doanh thu đơn hoàn thành" value={formatPrice(o.revenueCompleted)} hint="Tổng tiền các đơn ở trạng thái hoàn thành trong kỳ." />
          </div>

          <section className="card card__body" aria-labelledby="daily-title">
            <h2 id="daily-title" className="h3">Hoạt động theo ngày</h2>
            <div className="legend row small"><span className="legend__swatch legend__swatch--a" /> Lượt xem món <span className="legend__swatch legend__swatch--b" /> Lượt gợi ý</div>
            <div className="bar-chart" role="img" aria-label="Biểu đồ lượt xem và lượt gợi ý theo ngày">
              {o.daily.map((d) => (
                <div key={d.date} className="bar-chart__col" title={`${d.date}: ${d.views} lượt xem, ${d.recommendations} lượt gợi ý, ${d.orders} đơn`}>
                  <div className="bar-chart__bars">
                    <span className="bar bar--a" style={{ height: `${(d.views / maxDaily) * 100}%` }} />
                    <span className="bar bar--b" style={{ height: `${(d.recommendations / maxDaily) * 100}%` }} />
                  </div>
                  <span className="bar-chart__label">{d.date.slice(8, 10)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid-2">
            <section className="card card__body stack" aria-labelledby="rec-eff">
              <h2 id="rec-eff" className="h3">Hiệu quả gợi ý</h2>
              <dl className="dl">
                <dt>Lượt gợi ý hợp lệ</dt><dd>{q.data.rec.shown}</dd>
                <dt>Tỷ lệ mở món</dt><dd>{pct(q.data.rec.openRate)} <span className="subtle">({q.data.rec.withOpen}/{q.data.rec.shown})</span></dd>
                <dt>Tỷ lệ chọn món</dt><dd>{pct(q.data.rec.chooseRate)} <span className="subtle">({q.data.rec.withChoose}/{q.data.rec.shown})</span></dd>
                <dt>Tỷ lệ đặt món</dt><dd>{pct(q.data.rec.orderRate)}</dd>
              </dl>
              <details className="small"><summary>Định nghĩa các chỉ số</summary>
                <ul className="def-list">{Object.entries(q.data.rec.definitions).map(([k, v]) => <li key={k}>{v}</li>)}</ul>
              </details>
            </section>
            <section className="card card__body stack" aria-labelledby="top-dish">
              <h2 id="top-dish" className="h3">Món nổi bật</h2>
              {q.data.top.dishes.length === 0 ? <p className="muted">Chưa có dữ liệu trong kỳ.</p> : (
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>Món</th><th className="num">Xem</th><th className="num">Lưu</th><th className="num">Được gợi ý</th></tr></thead>
                  <tbody>{q.data.top.dishes.map((d) => <tr key={d.dishId}><td>{d.name}</td><td className="num">{d.views}</td><td className="num">{d.favorites}</td><td className="num">{d.suggested}</td></tr>)}</tbody>
                </table></div>
              )}
            </section>
            <section className="card card__body stack" aria-labelledby="top-kw">
              <h2 id="top-kw" className="h3">Từ khóa tìm kiếm</h2>
              {q.data.top.sampleSize.searches < 5 ? <p className="muted">Dữ liệu còn ít ({q.data.top.sampleSize.searches} lượt tìm), chưa đủ để suy ra xu hướng.</p> : null}
              <ul className="rank-list">{q.data.top.keywords.map((k) => <li key={k.keyword}><span>{k.keyword}</span><strong>{k.count}</strong></li>)}</ul>
            </section>
            <section className="card card__body stack" aria-labelledby="top-ing">
              <h2 id="top-ing" className="h3">Nguyên liệu được tìm nhiều</h2>
              {q.data.top.sampleSize.ingredientSearches < 5 && <p className="muted">Dữ liệu còn ít ({q.data.top.sampleSize.ingredientSearches} lượt), chưa đủ để suy ra xu hướng.</p>}
              <ul className="rank-list">{q.data.top.ingredients.map((k) => <li key={k.ingredientId}><span>{k.name}</span><strong>{k.count}</strong></li>)}</ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div className="kpi card">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{typeof value === 'number' ? value.toLocaleString('vi-VN') : value}</div>
      <div className="kpi__hint">{hint}</div>
    </div>
  );
}
