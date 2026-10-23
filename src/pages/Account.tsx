import { useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { useFormat } from '../format';
import { signUp, useShop } from '../state/app';
import { attemptLogin, setSession, useClient, useSession } from '../state/session';
import { Link, usePage } from '../shared/router';
import { clean, isEmail, isName } from '../shared/security';
import { useFeedback } from '../shared/ui/Feedback';
import { Field } from '../shared/ui/Field';

export default function Account() {
  const { t } = useFormat();
  usePage(t('title.account'));
  const session = useSession((s) => s.session);
  const client = useClient();
  const orders = useShop((s) => s.orders);
  if (session?.kind === 'staff') {
    return (
      <div className="wrap narrow view">
        <h1 tabIndex={-1}>{t('account.title')}</h1>
        <p>{t('account.staffHere', { name: session.staff.name })}</p>
        <Link className="btn btn-primary" to="/admin">{t('nav.admin')}</Link>
      </div>
    );
  }
  if (client) {
    const c = client;
    const mine = orders.filter((o) => o.clientId === c.id).length;
    return (
      <div className="wrap narrow view">
        <h1 tabIndex={-1}>{t('account.hello', { name: c.name.split(' ')[0] ?? c.name })}</h1>
        <div className="card">
          <p><strong>{c.name}</strong> · {c.email}</p>
          <p className="hint">{c.address ? t('account.address', { address: `${c.address.address}, ${c.address.zip} ${c.address.city}` }) : t('account.noAddress')}</p>
          <p>{t('account.orders', { n: mine })} <Link to="/mes-commandes">{t('nav.orders')}</Link></p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSession(null)}>{t('account.logout')}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="wrap narrow view">
      <Link className="back-link" to="/">{t('checkout.back')}</Link>
      <h1 tabIndex={-1}>{t('account.title')}</h1>
      <p>{t('account.lead')}</p>
      <AuthForms />
      <p className="hint">{t('account.staffNote')} <Link to="/admin">{t('nav.admin')}</Link></p>
    </div>
  );
}

function AuthForms() {
  const { t } = useFormat();
  const { toast } = useFeedback();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [v, setV] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const email = clean(v.email, 254).toLowerCase();
    const next: Record<string, string> = {};
    if (!isEmail(email)) next.email = t('err.email');
    if (mode === 'signup' && !isName(clean(v.name, 60))) next.name = t('err.name');
    if (mode === 'signup' && v.password.length < 10) next.password = t('err.password');
    flushSync(() => setErrors(next));
    if (Object.keys(next).length) { document.querySelector<HTMLElement>('.auth [aria-invalid="true"]')?.focus(); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const created = await signUp({ name: clean(v.name, 60), email, password: v.password });
        if (created === 'exists') { setErrors({ email: t('account.exists') }); return; }
        setSession({ kind: 'client', client: created });
        toast(t('account.created'));
        return;
      }
      const outcome = await attemptLogin(email, v.password);
      if (!outcome.ok) setErrors({ password: outcome.reason === 'locked' ? t('account.locked', { n: outcome.seconds }) : t('account.invalid') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card auth">
      <div className="seg" role="group" aria-label={t('account.mode')}>
        <button type="button" className="seg-btn" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setErrors({}); }}>{t('account.login')}</button>
        <button type="button" className="seg-btn" aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setErrors({}); }}>{t('account.signup')}</button>
      </div>
      <form className="form" noValidate onSubmit={(e) => void submit(e)}>
        {mode === 'signup' ? <Field label={t('field.name')} autoComplete="name" maxLength={60} value={v.name} onChange={(e) => set('name', e.target.value)} error={errors.name} /> : null}
        <Field label={t('field.email')} type="email" autoComplete="email" maxLength={254} value={v.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
        <Field label={t('account.password')} type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} maxLength={128}
          value={v.password} onChange={(e) => set('password', e.target.value)} error={errors.password} hint={mode === 'signup' ? t('account.passwordHint') : undefined} />
        <button type="submit" className="btn btn-primary" disabled={busy}>{mode === 'login' ? t('account.login') : t('account.signup')}</button>
      </form>
    </section>
  );
}
