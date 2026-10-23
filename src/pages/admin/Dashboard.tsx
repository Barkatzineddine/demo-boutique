import { useMemo, useState } from 'react';
import { LOW_STOCK, type StaffAccount } from '../../domain/catalog';
import { useFormat } from '../../format';
import { patchProduct, useShop } from '../../state/app';
import { navigate } from '../../shared/router';
import { useFeedback } from '../../shared/ui/Feedback';
import { useNow } from '../../shared/useNow';

const DAY = 864e5;
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Dashboard({ staff }: { staff: StaffAccount }) {
  const { t, cents: price, name, status, date, dateTime } = useFormat();
  const { toast } = useFeedback();
  const orders = useShop((s) => s.orders);
  const products = useShop((s) => s.products);
  const now = useNow(60_000);

  const stats = useMemo(() => {
    const live = orders.filter((o) => o.status !== 'refunded');
    const recent = live.filter((o) => now.getTime() - new Date(o.at).getTime() < 30 * DAY);
    const previous = live.filter((o) => { const age = now.getTime() - new Date(o.at).getTime(); return age >= 30 * DAY && age < 60 * DAY; });
    const revenue = recent.reduce((s, o) => s + o.totals.total, 0);
    const days = Array.from({ length: 30 }, (_, i) => isoDay(new Date(now.getTime() - (29 - i) * DAY)));
    const perDay = days.map((d) => recent.filter((o) => isoDay(new Date(o.at)) === d).reduce((s, o) => s + o.totals.total, 0));
    return {
      revenue, count: recent.length, previous: previous.reduce((s, o) => s + o.totals.total, 0),
      basket: recent.length ? Math.round(revenue / recent.length) : 0,
      todo: orders.filter((o) => o.status === 'paid' || o.status === 'preparing').length,
      days, perDay, max: Math.max(1, ...perDay),
    };
  }, [orders, now]);
  const alerts = products.filter((p) => p.published && p.stock <= LOW_STOCK).sort((a, b) => a.stock - b.stock);
  const best = [...products].sort((a, b) => b.sold - a.sold).slice(0, 5);
  const bestMax = Math.max(1, ...best.map((p) => p.sold));
  const feed = orders.slice(0, 6);
  const [hover, setHover] = useState<number | null>(null);
  const restock = (id: string, stock: number, label: string) => {
    const error = patchProduct(id, { stock: stock + 10 }, staff);
    toast(error ? t(`board.err.${error}`) : t('dash.restocked', { name: label, n: stock + 10 }), error ? 'err' : 'ok');
  };

  return (
    <div className="dash">
      <div className="kpis">
        <div className="kpi"><p className="kpi-label">{t('dash.revenue')}</p><p className="kpi-value">{price(stats.revenue)}</p>
          <p className="kpi-sub">{stats.previous ? t('dash.vsPrevious', { pct: Math.round(((stats.revenue - stats.previous) / stats.previous) * 100) }) : t('dash.orders', { n: stats.count })}</p></div>
        <div className="kpi"><p className="kpi-label">{t('dash.basket')}</p><p className="kpi-value">{price(stats.basket)}</p><p className="kpi-sub">{t('dash.orders', { n: stats.count })}</p></div>
        <div className="kpi"><p className="kpi-label">{t('dash.todo')}</p><p className="kpi-value">{stats.todo}</p><p className="kpi-sub">{t('dash.todoSub')}</p></div>
        <div className="kpi"><p className="kpi-label">{t('dash.stock')}</p><p className="kpi-value">{alerts.length}</p><p className="kpi-sub">{t('dash.stockSub', { n: LOW_STOCK })}</p></div>
      </div>

      <figure className="card chart">
        <figcaption><h2 className="card-h">{t('dash.perDay')}</h2><p className="hint">{t('dash.perDaySub')}</p></figcaption>
        <ol className="bars bars-30" aria-label={t('dash.perDay')}>
          {stats.days.map((d, i) => {
            const v = stats.perDay[i] ?? 0;
            return (
              <li key={d} className="bar-col" tabIndex={0} aria-label={`${date(d, { day: 'numeric', month: 'long' })} : ${price(v)}`}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                <span className="bar-track"><span className={`bar ${i === 29 ? 'today' : ''}`} style={{ height: `${Math.max((v / stats.max) * 100, 1.5)}%` }} /></span>
                <span className="bar-lab">{i % 5 === 4 ? date(d, { day: 'numeric' }) : ''}</span>
                {hover === i ? <span className="bar-tip" role="tooltip">{date(d, { weekday: 'short', day: 'numeric', month: 'short' })}<br /><strong>{price(v)}</strong></span> : null}
              </li>
            );
          })}
        </ol>
        <details className="data-table"><summary>{t('dash.table')}</summary>
          <table className="table"><tbody>{stats.days.map((d, i) => <tr key={d}><th scope="row">{date(d, { day: 'numeric', month: 'long' })}</th><td>{price(stats.perDay[i] ?? 0)}</td></tr>)}</tbody></table>
        </details>
      </figure>

      <div className="two-col">
        <section className="card">
          <h2 className="card-h">{t('dash.feed')}</h2>
          <ul className="feed">
            {feed.map((o) => (
              <li key={o.id}>
                <button type="button" className="linklike" onClick={() => navigate(`/admin?tab=board&o=${o.id}`)}>{o.number}</button>
                <span>{o.customer.name} · {price(o.totals.total)}</span>
                <span className={`chip st-${o.status}`}>{status(o.status)}</span>
                <span className="hint">{dateTime(o.at)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2 className="card-h">{t('dash.best')}</h2>
          <ul className="hbars">
            {best.map((p) => (
              <li key={p.id}><span>{name(p)}</span><span className="hb-track"><span className="hb-bar" style={{ width: `${(p.sold / bestMax) * 100}%` }} /><span className="hb-val">{p.sold}</span></span></li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card">
        <h2 className="card-h">{t('dash.alerts')}</h2>
        {alerts.length ? (
          <ul className="plain-list alerts">
            {alerts.map((p) => (
              <li key={p.id} className="row-between">
                <span><strong>{name(p)}</strong> · <span className={p.stock ? 'stock low' : 'stock out'}>{p.stock ? t('stock.low', { n: p.stock }) : t('stock.out')}</span></span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => restock(p.id, p.stock, name(p))}>{t('dash.restock')}<span className="sr"> {name(p)}</span></button>
              </li>
            ))}
          </ul>
        ) : <p className="hint">{t('dash.noAlert')}</p>}
      </section>
    </div>
  );
}
