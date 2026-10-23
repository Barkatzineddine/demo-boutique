import { useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { FREE_SHIPPING, PROMO, SHIPPING, SHIPPING_IDS, type ShippingId } from '../domain/catalog';
import { deliveryDate, isAddress, isFrenchZip, orderTotals } from '../domain/pricing';
import type { Customer } from '../domain/schema';
import { useFormat } from '../format';
import { placeOrder, saveAddress } from '../state/app';
import { rememberOrder, useClient } from '../state/session';
import { useFormGuard } from '../shared/formGuard';
import { Link, navigate, usePage } from '../shared/router';
import { clean, isEmail, isName, isPhoneFR, normPhone } from '../shared/security';
import { useFeedback } from '../shared/ui/Feedback';
import { Checkbox, Field, Honeypot } from '../shared/ui/Field';
import { useCart, Tile } from '../ui/shop';

type Step = 0 | 1 | 2;
const EMPTY: Customer = { name: '', email: '', phone: '', address: '', zip: '', city: '' };

export default function Checkout() {
  const { t, price, cents, name, glaze, date } = useFormat();
  usePage(t('title.checkout'));
  const { toast } = useFeedback();
  const client = useClient();
  const { lines, subtotal } = useCart();
  const [step, setStep] = useState<Step>(0);
  const [customer, setCustomer] = useState<Customer>(client?.address ?? { ...EMPTY, name: client?.name ?? '', email: client?.email ?? '' });
  const [saveIt, setSaveIt] = useState(true);
  const [shipping, setShipping] = useState<ShippingId>('colissimo');
  const [promo, setPromo] = useState(false);
  const [method, setMethod] = useState<'card' | 'paypal'>('card');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totals = orderTotals(lines.map((l) => ({ price: l.product.price, qty: l.qty })), shipping, promo);
  const go = (s: Step) => { setStep(s); setError(null); requestAnimationFrame(() => document.querySelector<HTMLElement>('.co-step.active .co-step-title')?.focus()); };

  if (!lines.length && !busy) {
    return (
      <div className="wrap narrow view">
        <h1 tabIndex={-1}>{t('checkout.title')}</h1>
        <p>{t('cart.empty')}</p>
        <Link className="btn btn-primary" to="/">{t('cart.browse')}</Link>
      </div>
    );
  }

  const pay = (outcome: 'ok' | 'declined') => {
    if (!terms) { setError(t('err.terms')); return; }
    setBusy(true);
    setError(null);
    window.setTimeout(() => {
      if (outcome === 'declined') { setBusy(false); setError(t('pay.declined')); return; }
      const result = placeOrder({ customer, shipping, promo, method, clientId: client?.id, expectedTotal: totals.total });
      if (!result.ok) {
        setBusy(false);
        setError(t(`pay.err.${result.error}`));
        return;
      }
      rememberOrder(result.order.id);
      if (client && saveIt) saveAddress(client.id, customer);
      navigate(`/confirmation/${result.order.number}`);
    }, 1200);
  };

  const stepHead = (i: Step, title: string, summary?: string) => (
    <div className="co-step-head">
      <h2 className="co-step-title" tabIndex={-1}><span className="n" aria-hidden="true">{step > i ? '✓' : i + 1}</span>{title}</h2>
      {step > i ? <button type="button" className="linklike" onClick={() => go(i)}>{t('common.edit')}<span className="sr"> : {title}</span></button> : null}
      {step > i && summary ? <p className="co-done hint">{summary}</p> : null}
    </div>
  );

  return (
    <div className="wrap view">
      <Link className="back-link" to="/">{t('checkout.back')}</Link>
      <h1 tabIndex={-1}>{t('checkout.title')}</h1>
      <div className="co-grid">
        <div className="co-steps">
          <section className={`card co-step ${step === 0 ? 'active' : ''}`}>
            {stepHead(0, t('checkout.details'), `${customer.name} · ${customer.address}, ${customer.zip} ${customer.city}`)}
            {step === 0 ? <Details value={customer} client={!!client} saveIt={saveIt} setSaveIt={setSaveIt} onDone={(c) => { setCustomer(c); go(1); }} /> : null}
          </section>
          <section className={`card co-step ${step === 1 ? 'active' : ''}`}>
            {stepHead(1, t('checkout.delivery'), `${t(`ship.${shipping}.name`)} · ${t('order.eta', { date: date(deliveryDate(shipping, new Date())) })}`)}
            {step === 1 ? (
              <form className="form" onSubmit={(e) => { e.preventDefault(); go(2); }}>
                <fieldset className="options">
                  <legend className="sr">{t('checkout.delivery')}</legend>
                  {SHIPPING_IDS.map((id) => {
                    const free = SHIPPING[id].price === 0 || subtotal - totals.discount >= FREE_SHIPPING;
                    return (
                      <label key={id} className="option">
                        <input type="radio" name="ship" value={id} checked={shipping === id} onChange={() => setShipping(id)} />
                        <span className="o-main"><strong>{t(`ship.${id}.name`)}</strong><span className="hint">{t(`ship.${id}.detail`)} · {t('order.eta', { date: date(deliveryDate(id, new Date())) })}</span></span>
                        <span className="o-price">{free ? t('totals.free') : price(SHIPPING[id].price)}</span>
                      </label>
                    );
                  })}
                </fieldset>
                <button type="submit" className="btn btn-primary">{t('checkout.toPayment')}</button>
              </form>
            ) : null}
          </section>
          <section className={`card co-step ${step === 2 ? 'active' : ''}`}>
            {stepHead(2, t('checkout.payment'))}
            {step === 2 ? (
              <div className="form">
                <p className="test-banner" role="note"><strong>{t('pay.testMode')}</strong> : {t('pay.testText')}</p>
                <fieldset className="options">
                  <legend className="sr">{t('pay.method')}</legend>
                  {(['card', 'paypal'] as const).map((m) => (
                    <label key={m} className="option">
                      <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} />
                      <span className="o-main"><strong>{t(`pay.${m}`)}</strong><span className="hint">{t(`pay.${m}Hint`)}</span></span>
                    </label>
                  ))}
                </fieldset>
                {method === 'card' ? (
                  <div className="fake-card" role="img" aria-label={t('pay.cardLabel')}>
                    <span className="fc-chip" aria-hidden="true" />
                    <span className="fc-num" aria-hidden="true">4242 4242 4242 4242</span>
                    <span className="fc-row" aria-hidden="true"><span>{t('pay.testCard')}</span><span>12/34</span></span>
                  </div>
                ) : null}
                {error ? <p className="alert" role="alert">{error}</p> : null}
                <Checkbox label={t('pay.terms')} checked={terms} onChange={(e) => { setTerms(e.target.checked); setError(null); }} />
                <div className="form-actions">
                  <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => pay('ok')}>
                    {busy ? t('pay.busy') : t('pay.pay', { amount: cents(totals.total) })}
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => pay('declined')}>{t('pay.simulateDecline')}</button>
                </div>
                <p className="hint">{t('pay.prodNote')}</p>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="co-summary card" aria-label={t('checkout.summary')}>
          <h2>{t('checkout.summary')}</h2>
          <ul className="mini-lines">
            {lines.map((l) => (
              <li key={`${l.id}-${l.glaze}`}>
                <Tile product={l.product} glaze={l.glaze} className="tile tile-xs" />
                <span>{name(l.product)}<br /><span className="hint">{glaze(l.glaze)} × {l.qty}</span></span>
                <span>{price(l.product.price * l.qty)}</span>
              </li>
            ))}
          </ul>
          <PromoForm applied={promo} onApply={() => { setPromo(true); toast(t('promo.applied')); }} />
          <dl className="totals">
            <div><dt>{t('totals.subtotal')}</dt><dd>{cents(totals.subtotal)}</dd></div>
            {totals.discount ? <div><dt>{t('totals.discount')}</dt><dd>−{cents(totals.discount)}</dd></div> : null}
            <div><dt>{t('totals.shipping')}</dt><dd>{totals.ship ? cents(totals.ship) : t('totals.free')}</dd></div>
            <div className="grand"><dt>{t('totals.total')}</dt><dd>{cents(totals.total)}</dd></div>
            <div className="vat"><dt>{t('totals.vat')}</dt><dd>{cents(totals.vat)}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Details({ value, client, saveIt, setSaveIt, onDone }: {
  value: Customer; client: boolean; saveIt: boolean; setSaveIt: (v: boolean) => void; onDone: (c: Customer) => void;
}) {
  const { t } = useFormat();
  const { toast } = useFeedback();
  const guard = useFormGuard({ key: 'kaolin:checkout', max: 6, windowMs: 30 * 60_000, minMs: 1500 });
  const [v, setV] = useState(value);
  const [errors, setErrors] = useState<Partial<Record<keyof Customer, string>>>({});
  const set = (k: keyof Customer, val: string) => setV((s) => ({ ...s, [k]: val }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c: Customer = {
      email: clean(v.email, 254).toLowerCase(), name: clean(v.name, 60), phone: clean(v.phone, 20),
      address: clean(v.address, 120), zip: clean(v.zip, 5), city: clean(v.city, 60),
    };
    const next: Partial<Record<keyof Customer, string>> = {};
    if (!isEmail(c.email)) next.email = t('err.email');
    if (!isName(c.name)) next.name = t('err.name');
    if (!isPhoneFR(c.phone)) next.phone = t('err.phone');
    if (!isAddress(c.address)) next.address = t('err.address');
    if (!isFrenchZip(c.zip)) next.zip = t('err.zip');
    if (!isName(c.city)) next.city = t('err.city');
    flushSync(() => setErrors(next)); // render the errors first, then focus the first one
    if (Object.keys(next).length) { document.querySelector<HTMLElement>('.co-step.active [aria-invalid="true"]')?.focus(); return; }
    const verdict = guard.check();
    if (!verdict.ok) {
      if (verdict.silent) return;
      toast(verdict.reason === 'too-fast' ? t('err.tooFast') : t('err.rate', { n: verdict.waitMinutes ?? 1 }), 'err');
      return;
    }
    verdict.commit();
    onDone({ ...c, phone: normPhone(c.phone) });
  };

  return (
    <form className="form" noValidate onSubmit={submit}>
      <Field label={t('field.email')} type="email" autoComplete="email" maxLength={254} value={v.email} onChange={(e) => set('email', e.target.value)} error={errors.email} hint={t('field.emailHint')} />
      <div className="row2">
        <Field label={t('field.name')} autoComplete="name" maxLength={60} value={v.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
        <Field label={t('field.phone')} type="tel" autoComplete="tel" maxLength={20} value={v.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} hint={t('field.phoneHint')} />
      </div>
      <Field label={t('field.address')} autoComplete="street-address" maxLength={120} value={v.address} onChange={(e) => set('address', e.target.value)} error={errors.address} />
      <div className="row2">
        <Field label={t('field.zip')} autoComplete="postal-code" inputMode="numeric" maxLength={5} value={v.zip} onChange={(e) => set('zip', e.target.value)} error={errors.zip} />
        <Field label={t('field.city')} autoComplete="address-level2" maxLength={60} value={v.city} onChange={(e) => set('city', e.target.value)} error={errors.city} />
      </div>
      <p className="hint">{t('checkout.franceOnly')}</p>
      {client ? <Checkbox label={t('checkout.saveAddress')} checked={saveIt} onChange={(e) => setSaveIt(e.target.checked)} /> : null}
      <Honeypot inputRef={guard.honeypotRef} label={t('honeypot')} />
      <button type="submit" className="btn btn-primary">{t('checkout.toDelivery')}</button>
    </form>
  );
}

function PromoForm({ applied, onApply }: { applied: boolean; onApply: () => void }) {
  const { t } = useFormat();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="promo" noValidate onSubmit={(e) => {
      e.preventDefault();
      if (clean(code, 20).toUpperCase() !== PROMO.code) { setError(t('promo.unknown')); return; }
      setError(null);
      onApply();
    }}>
      <div className="promo-row">
        <Field label={t('promo.label')} maxLength={20} autoComplete="off" value={code} disabled={applied} placeholder={PROMO.code}
          onChange={(e) => setCode(e.target.value)} error={error} hint={applied ? t('promo.done') : t('promo.hint', { code: PROMO.code })} />
        <button type="submit" className="btn btn-ghost btn-sm" disabled={applied}>{t('promo.apply')}</button>
      </div>
    </form>
  );
}

