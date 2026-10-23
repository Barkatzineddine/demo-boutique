import { useState, type FormEvent } from 'react';
import type { Order } from '../domain/schema';
import { useFormat } from '../format';
import { useShop } from '../state/app';
import { deviceOrderIds, rememberOrder, useSession } from '../state/session';
import { useFormGuard } from '../shared/formGuard';
import { Link, usePage } from '../shared/router';
import { clean } from '../shared/security';
import { Field } from '../shared/ui/Field';
import { OrderDetail } from '../ui/orders';

/** Orders this visitor may see: placed on this device, or linked to their account. */
function useMyOrders(): Order[] {
  const orders = useShop((s) => s.orders);
  const session = useSession((s) => s.session);
  const ids = deviceOrderIds();
  return orders.filter((o) => ids.includes(o.id) || (session?.kind === 'client' && o.clientId === session.client.id));
}

export function Confirmation({ number }: { number: string }) {
  const { t, date } = useFormat();
  const order = useMyOrders().find((o) => o.number === number);
  usePage(order ? t('title.confirmation') : t('order.notFound'));
  if (!order) {
    return (
      <div className="wrap narrow view">
        <h1 tabIndex={-1}>{t('order.notFound')}</h1>
        <p>{t('order.notFoundText')}</p>
        <Link className="btn btn-primary" to="/mes-commandes">{t('nav.orders')}</Link>
      </div>
    );
  }
  return (
    <div className="wrap narrow view">
      <div className="card confirm">
        <div className="confirm-mark" aria-hidden="true">✓</div>
        <h1 tabIndex={-1}>{t('confirm.thanks', { name: order.customer.name.split(' ')[0] ?? '' })}</h1>
        <p className="lead">{t('confirm.lead')} <strong className="order-number">{order.number}</strong></p>
        <p className="hint">{t('confirm.mail', { email: order.customer.email, date: date(order.eta) })}</p>
      </div>
      <OrderDetail order={order} />
      <p className="hint no-print">{t('confirm.live')}</p>
      <div className="form-actions no-print">
        <button type="button" className="btn btn-ghost" onClick={() => window.print()}>{t('confirm.print')}</button>
        <Link className="btn btn-ghost" to="/mes-commandes">{t('nav.orders')}</Link>
        <Link className="btn btn-ghost" to="/admin">{t('confirm.admin')}</Link>
        <Link className="btn btn-primary" to="/">{t('confirm.continue')}</Link>
      </div>
    </div>
  );
}

export default function MyOrders() {
  const { t, dateTime } = useFormat();
  usePage(t('title.orders'));
  const orders = useMyOrders();
  return (
    <div className="wrap narrow view">
      <Link className="back-link" to="/">{t('checkout.back')}</Link>
      <h1 tabIndex={-1}>{t('nav.orders')}</h1>
      {orders.length ? (
        <ul className="plain-list">
          {orders.map((o) => (
            <li key={o.id}>
              <h2 className="order-title">{o.number} <span className="hint">· {dateTime(o.at)}</span></h2>
              <OrderDetail order={o} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="card empty"><p>{t('orders.none')}</p><Link className="btn btn-primary" to="/">{t('cart.browse')}</Link></div>
      )}
      <p className="hint">{t('orders.live')}</p>
      <Lookup />
    </div>
  );
}

/** Find an order placed elsewhere with its number and e-mail (rate-limited against guessing). */
function Lookup() {
  const { t } = useFormat();
  const orders = useShop((s) => s.orders);
  const guard = useFormGuard({ key: 'kaolin:lookup', max: 5, windowMs: 10 * 60_000, minMs: 0, maxLinks: 99 });
  const [number, setNumber] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const verdict = guard.check();
    if (!verdict.ok) { if (!verdict.silent) setMessage(t('err.rate', { n: verdict.waitMinutes ?? 1 })); return; }
    verdict.commit();
    const n = clean(number, 20).toUpperCase(), m = clean(email, 254).toLowerCase();
    const found = orders.find((o) => o.number === n && o.customer.email === m);
    // same message whatever was wrong: the form does not reveal which orders exist
    if (!found) { setMessage(t('lookup.none')); return; }
    rememberOrder(found.id);
    setMessage(t('lookup.added', { number: found.number }));
    setNumber(''); setEmail('');
  };
  return (
    <form className="card form lookup" noValidate onSubmit={submit}>
      <h2 className="card-h">{t('lookup.title')}</h2>
      <div className="row2">
        <Field label={t('lookup.number')} placeholder="KC-2026-01180" maxLength={20} autoComplete="off" value={number} onChange={(e) => setNumber(e.target.value)} />
        <Field label={t('field.email')} type="email" maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-ghost">{t('lookup.submit')}</button>
      <p className="hint" aria-live="polite">{message}</p>
    </form>
  );
}
