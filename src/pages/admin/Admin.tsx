import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react';
import { can, DEMO_LOGINS, type StaffAccount } from '../../domain/catalog';
import { useFormat } from '../../format';
import type { Key } from '../../i18n';
import { useShop } from '../../state/app';
import { attemptLogin, setSession, useSession } from '../../state/session';
import { Link, navigate, useLocation, usePage } from '../../shared/router';
import { CommandPalette, type Command } from '../../shared/ui/CommandPalette';
import { Field } from '../../shared/ui/Field';

const Dashboard = lazy(() => import('./Dashboard'));
const Board = lazy(() => import('./Board'));
const Products = lazy(() => import('./Products'));

type Tab = 'dash' | 'board' | 'products';

export default function Admin() {
  const { t } = useFormat();
  usePage(t('title.admin'));
  const session = useSession((s) => s.session);
  return session?.kind === 'staff' ? <AdminArea staff={session.staff} /> : <AdminLogin />;
}

function AdminLogin() {
  const { t } = useFormat();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const outcome = await attemptLogin(email, password);
    setBusy(false);
    if (!outcome.ok) { setError(outcome.reason === 'locked' ? t('account.locked', { n: outcome.seconds }) : t('account.invalid')); return; }
    const session = useSession.getState().session;
    if (session?.kind !== 'staff') { setSession(null); setError(t('admin.notStaff')); }
  };
  return (
    <div className="wrap narrow view">
      <Link className="back-link" to="/">{t('checkout.back')}</Link>
      <h1 tabIndex={-1}>{t('nav.admin')}</h1>
      <p>{t('admin.lead')}</p>
      <form className="card form login" noValidate onSubmit={(e) => void submit(e)}>
        <Field label={t('field.email')} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label={t('account.password')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        <button type="submit" className="btn btn-primary" disabled={busy}>{t('account.login')}</button>
      </form>
      <section className="card demo-logins">
        <h2 className="card-h">{t('admin.demo')}</h2>
        <ul>
          {DEMO_LOGINS.map((d) => (
            <li key={d.email}>
              <div><strong>{t(`role.${d.role}`)}</strong> · {t(`role.${d.role}.note`)}<br /><code>{d.email}</code> / <code>{d.password}</code></div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEmail(d.email); setPassword(d.password); setError(null); }}>{t('admin.use')}</button>
            </li>
          ))}
        </ul>
        <p className="hint">{t('admin.prodNote')}</p>
      </section>
    </div>
  );
}

function AdminArea({ staff }: { staff: StaffAccount }) {
  const { t, name, status } = useFormat();
  const { query } = useLocation();
  const orders = useShop((s) => s.orders);
  const products = useShop((s) => s.products);
  const tabs: Tab[] = can(staff.role, 'dashboard') ? ['dash', 'board', 'products'] : ['board'];
  const tab = (tabs.find((x) => x === query.get('tab')) ?? tabs[0]) as Tab;
  const setTab = (next: Tab) => navigate(`/admin?tab=${next}`);
  const todo = orders.filter((o) => o.status === 'paid').length;

  const commands = useMemo<Command[]>(() => [
    ...tabs.map((x) => ({ id: `tab-${x}`, group: t('palette.go'), label: t(`admin.tab.${x}`), run: () => setTab(x) })),
    ...orders.slice(0, 300).map((o) => ({
      id: o.id, group: t('palette.orders'), label: `${o.number} · ${o.customer.name}`, hint: `${status(o.status)} · ${o.customer.city}`,
      keywords: `${o.customer.email} ${o.customer.zip}`, run: () => navigate(`/admin?tab=board&o=${o.id}`),
    })),
    ...(can(staff.role, 'products.edit') ? products.map((p) => ({
      id: `p-${p.id}`, group: t('palette.products'), label: name(p), hint: t('admin.stockN', { n: p.stock }), keywords: p.name.fr,
      run: () => navigate(`/admin?tab=products&p=${p.id}`),
    })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [orders, products, staff.role, t, name, status]);

  return (
    <div className="wrap admin view">
      <div className="admin-head">
        <div>
          <Link className="back-link" to="/">{t('checkout.back')}</Link>
          <h1 tabIndex={-1}>{t('nav.admin')}</h1>
          <p className="hint">{t('admin.hello', { name: staff.name, role: t(`role.${staff.role}`) })}</p>
        </div>
        <div className="admin-tools">
          <CommandPalette commands={commands} labels={{ title: t('palette.title'), placeholder: t('palette.placeholder'), empty: t('palette.empty'), open: t('palette.open') }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSession(null)}>{t('account.logout')}</button>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label={t('nav.admin')}>
        {tabs.map((x) => (
          <button key={x} type="button" role="tab" id={`tab-${x}`} aria-selected={tab === x} aria-controls="panel" tabIndex={tab === x ? 0 : -1}
            onClick={() => setTab(x)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              const next = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length] as Tab;
              setTab(next);
              requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
            }}>
            {t(`admin.tab.${x}` as Key)}{x === 'board' && todo ? <span className="badge">{todo}</span> : null}
          </button>
        ))}
      </div>
      <div id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="panel">
        <Suspense fallback={<div className="route-loading" />}>
          {tab === 'dash' ? <Dashboard staff={staff} /> : null}
          {tab === 'board' ? <Board staff={staff} focus={query.get('o')} /> : null}
          {tab === 'products' ? <Products staff={staff} focus={query.get('p')} /> : null}
        </Suspense>
      </div>
    </div>
  );
}
