// Order detail with its status timeline, shared by the confirmation, "my orders" and the admin.
import { ORDER_FLOW, SHIPPING } from '../domain/catalog';
import type { Order } from '../domain/schema';
import { useFormat } from '../format';

export function Timeline({ order }: { order: Order }) {
  const { t, status, dateTime } = useFormat();
  if (order.status === 'refunded') return <p className="chip chip-warn">{status('refunded')}</p>;
  const at = ORDER_FLOW.indexOf(order.status);
  const when = (s: Order['status']) => [...order.history].reverse().find((h) => h.status === s)?.at;
  return (
    <ol className="timeline" aria-label={t('order.statusIs', { status: status(order.status) })}>
      {ORDER_FLOW.map((s, i) => {
        const at2 = i <= at ? when(s) : undefined;
        return (
          <li key={s} className={`${i <= at ? 'done' : ''} ${i === at ? 'now' : ''}`} aria-current={i === at ? 'step' : undefined}>
            <span>{status(s)}</span>
            {at2 ? <span className="tl-date">{dateTime(at2)}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDetail({ order }: { order: Order }) {
  const { t, cents: price, name, glaze, date } = useFormat();
  const tt = order.totals;
  const c = order.customer;
  return (
    <div className="card order-detail">
      <Timeline order={order} />
      <ul className="mini-lines">
        {order.items.map((i) => (
          <li key={`${i.id}-${i.glaze}`}>
            <span>{name(i)}<br /><span className="hint">{glaze(i.glaze)} × {i.qty}</span></span>
            <span>{price(i.price * i.qty)}</span>
          </li>
        ))}
      </ul>
      <dl className="totals">
        <div><dt>{t('totals.subtotal')}</dt><dd>{price(tt.subtotal)}</dd></div>
        {tt.discount ? <div><dt>{t('totals.discount')}</dt><dd>−{price(tt.discount)}</dd></div> : null}
        <div><dt>{t(`ship.${order.shipping}.name`)}</dt><dd>{tt.ship ? price(tt.ship) : t('totals.free')}</dd></div>
        <div className="grand"><dt>{t('totals.paid')}</dt><dd>{price(tt.total)}</dd></div>
        <div className="vat"><dt>{t('totals.vat')}</dt><dd>{price(tt.vat)}</dd></div>
      </dl>
      <p className="hint">
        {t('order.deliverTo', { name: c.name, address: `${c.address}, ${c.zip} ${c.city}` })}
        {order.status !== 'refunded' && order.status !== 'delivered' ? <> · {t('order.eta', { date: date(order.eta) })}</> : null}
        {SHIPPING[order.shipping].price === 0 ? <> · {t('ship.atelier.where')}</> : null}
      </p>
    </div>
  );
}
