import { useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { BADGES, CATEGORY_IDS, GLAZE_IDS, SHAPE_IDS, type StaffAccount } from '../../domain/catalog';
import type { Product } from '../../domain/schema';
import { useFormat } from '../../format';
import { deleteProduct, patchProduct, saveProduct, slugFor, useShop } from '../../state/app';
import { ImageError, reencodeImage } from '../../shared/image';
import { Link, navigate } from '../../shared/router';
import { clean } from '../../shared/security';
import { useFeedback } from '../../shared/ui/Feedback';
import { Checkbox, Field, Select, TextArea } from '../../shared/ui/Field';
import { Swatch } from '../../ui/Art';
import { ProductCard } from '../../ui/shop';

const NEW: Product = {
  id: '', name: { fr: '', en: '' }, desc: { fr: '', en: '' }, cat: 'tasses', shape: 'mug', price: 3000, glazes: ['cendre'],
  stock: 10, published: true, badge: 'new', sold: 0, scale: 1, size: '', image: '',
};

export default function Products({ staff, focus }: { staff: StaffAccount; focus: string | null }) {
  const { t, price, name, category, glaze } = useFormat();
  const { toast } = useFeedback();
  const products = useShop((s) => s.products);
  const editing = focus === 'new' ? NEW : focus ? products.find((p) => p.id === focus) ?? null : null;
  if (focus && editing) return <Editor key={focus} staff={staff} product={editing} isNew={focus === 'new'} />;

  const patch = (p: Product, change: Partial<Pick<Product, 'stock' | 'published'>>, message: string) => {
    const error = patchProduct(p.id, change, staff);
    toast(error ? t(`board.err.${error}`) : message, error ? 'err' : 'ok');
  };
  return (
    <section>
      <div className="row-between">
        <p className="hint">{t('products.count', { n: products.length, online: products.filter((p) => p.published).length })}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/admin?tab=products&p=new')}>{t('products.new')}</button>
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead><tr>{['products.col.product', 'products.col.category', 'products.col.price', 'products.col.stock', 'products.col.online', 'products.col.actions'].map((k) => <th key={k} scope="col">{t(k as Parameters<typeof t>[0])}</th>)}</tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><strong>{name(p)}</strong><br /><span className="hint">{p.glazes.map(glaze).join(', ')}</span></td>
                <td>{category(p.cat)}</td>
                <td>{price(p.price)}</td>
                <td>
                  <input className="stock-input" type="number" min={0} max={9999} defaultValue={p.stock} key={p.stock} aria-label={t('products.stockOf', { name: name(p) })}
                    onBlur={(e) => { const n = Math.max(0, Math.min(9999, Math.round(Number(e.target.value)) || 0)); if (n !== p.stock) patch(p, { stock: n }, t('products.stockSaved', { name: name(p), n })); }} />
                </td>
                <td>
                  <input type="checkbox" checked={p.published} aria-label={t('products.onlineOf', { name: name(p) })}
                    onChange={(e) => patch(p, { published: e.target.checked }, e.target.checked ? t('products.nowOnline', { name: name(p) }) : t('products.nowHidden', { name: name(p) }))} />
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => navigate(`/admin?tab=products&p=${p.id}`)}>{t('common.edit')}<span className="sr"> {name(p)}</span></button>
                    <Link className="btn btn-ghost btn-xs" to={`/produit/${p.id}`}>{t('products.view')}<span className="sr"> {name(p)}</span></Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Editor({ staff, product, isNew }: { staff: StaffAccount; product: Product; isNew: boolean }) {
  const { t, glaze, category, shape } = useFormat();
  const { toast, confirm } = useFeedback();
  const products = useShop((s) => s.products);
  const [draft, setDraft] = useState<Product>(product);
  const [euros, setEuros] = useState(String(product.price / 100));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<string>(product.image ? t('editor.photoKept') : t('editor.photoNone'));
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const close = () => navigate('/admin?tab=products');

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhoto(t('editor.photoWorking'));
    try {
      const image = await reencodeImage(file);
      set('image', image);
      setPhoto(t('editor.photoDone', { kb: Math.round((image.length * 0.75) / 1024) }));
    } catch (e) {
      setPhoto(t(`editor.photoErr.${e instanceof ImageError ? e.problem : 'decode'}`));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = Math.round(Number(euros.replace(',', '.')) * 100);
    const p: Product = {
      ...draft,
      name: { fr: clean(draft.name.fr, 80), en: clean(draft.name.en, 80) || clean(draft.name.fr, 80) },
      desc: { fr: clean(draft.desc.fr, 600, true), en: clean(draft.desc.en, 600, true) || clean(draft.desc.fr, 600, true) },
      size: clean(draft.size, 60), price: cents, stock: Math.max(0, Math.min(9999, Math.round(draft.stock) || 0)),
    };
    const next: Record<string, string> = {};
    if (p.name.fr.length < 3) next.nameFr = t('editor.err.name');
    if (!(cents >= 100 && cents <= 500_000)) next.price = t('editor.err.price');
    if (p.desc.fr.length < 20) next.descFr = t('editor.err.desc');
    if (!p.glazes.length) next.glazes = t('editor.err.glazes');
    flushSync(() => setErrors(next));
    if (Object.keys(next).length) { document.querySelector<HTMLElement>('.editor [aria-invalid="true"]')?.focus(); return; }
    if (isNew) p.id = slugFor(p.name.fr, products.map((x) => x.id));
    const error = saveProduct(p, staff, isNew ? null : product.id);
    if (error) { toast(t(`board.err.${error}`), 'err'); return; }
    toast(isNew ? t('editor.created') : t('editor.saved'));
    close();
  };

  const remove = async () => {
    if (!(await confirm({ title: t('editor.deleteTitle', { name: draft.name.fr }), body: t('editor.deleteBody'), ok: t('common.delete'), cancel: t('common.cancel'), danger: true }))) return;
    const error = deleteProduct(product.id, staff);
    toast(error ? t(`board.err.${error}`) : t('editor.deleted'), error ? 'err' : 'ok');
    if (!error) close();
  };

  const preview: Product = { ...draft, name: { fr: draft.name.fr || t('editor.namePh'), en: draft.name.en || draft.name.fr || t('editor.namePh') }, price: Math.round(Number(euros.replace(',', '.')) * 100) || 0, glazes: draft.glazes.length ? draft.glazes : ['cendre'] };

  return (
    <div className="editor">
      <h2 className="card-h">{isNew ? t('editor.newTitle') : t('editor.editTitle', { name: product.name.fr })}</h2>
      <div className="editor-grid">
        <form className="card form" noValidate onSubmit={submit}>
          <div className="row2">
            <Field label={t('editor.nameFr')} maxLength={80} value={draft.name.fr} onChange={(e) => set('name', { ...draft.name, fr: e.target.value })} error={errors.nameFr} />
            <Field label={t('editor.nameEn')} maxLength={80} value={draft.name.en} onChange={(e) => set('name', { ...draft.name, en: e.target.value })} hint={t('editor.enHint')} />
          </div>
          <div className="row2">
            <Select label={t('editor.category')} value={draft.cat} onChange={(e) => set('cat', e.target.value as Product['cat'])}>
              {CATEGORY_IDS.map((c) => <option key={c} value={c}>{category(c)}</option>)}
            </Select>
            <Select label={t('editor.shape')} value={draft.shape} onChange={(e) => set('shape', e.target.value as Product['shape'])}>
              {SHAPE_IDS.map((s) => <option key={s} value={s}>{shape(s)}</option>)}
            </Select>
          </div>
          <fieldset>
            <legend>{t('editor.glazes')}</legend>
            <div className="chips">
              {GLAZE_IDS.map((g) => (
                <label key={g} className="chip-check">
                  <input type="checkbox" checked={draft.glazes.includes(g)} onChange={(e) => set('glazes', e.target.checked ? GLAZE_IDS.filter((x) => x === g || draft.glazes.includes(x)) : draft.glazes.filter((x) => x !== g))} />
                  <Swatch glaze={g} />{glaze(g)}
                </label>
              ))}
            </div>
            {errors.glazes ? <p className="field-error" role="alert">{errors.glazes}</p> : null}
          </fieldset>
          <div className="row3">
            <Field label={t('editor.price')} inputMode="decimal" maxLength={8} value={euros} onChange={(e) => setEuros(e.target.value)} error={errors.price} />
            <Field label={t('editor.stock')} type="number" min={0} max={9999} value={draft.stock} onChange={(e) => set('stock', Number(e.target.value))} />
            <Select label={t('editor.badge')} value={draft.badge} onChange={(e) => set('badge', e.target.value as Product['badge'])}>
              {BADGES.map((b) => <option key={b} value={b}>{b ? t(`badge.${b}`) : t('editor.noBadge')}</option>)}
            </Select>
          </div>
          <Field label={t('editor.size')} maxLength={60} placeholder="30 cl · H 9,5 cm" value={draft.size} onChange={(e) => set('size', e.target.value)} />
          <TextArea label={t('editor.descFr')} rows={4} maxLength={600} value={draft.desc.fr} onChange={(e) => set('desc', { ...draft.desc, fr: e.target.value })} error={errors.descFr} />
          <TextArea label={t('editor.descEn')} rows={3} maxLength={600} value={draft.desc.en} onChange={(e) => set('desc', { ...draft.desc, en: e.target.value })} hint={t('editor.enHint')} />
          <div className="field">
            <label htmlFor="e-photo">{t('editor.photo')}</label>
            <input id="e-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void onPhoto(e.target.files?.[0])} />
            <p className="hint" aria-live="polite">{photo}</p>
            {draft.image ? <button type="button" className="linklike" onClick={() => { set('image', ''); setPhoto(t('editor.photoRemoved')); }}>{t('editor.photoRemove')}</button> : null}
          </div>
          <Checkbox label={t('editor.published')} checked={draft.published} onChange={(e) => set('published', e.target.checked)} />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">{isNew ? t('editor.create') : t('editor.save')}</button>
            <button type="button" className="btn btn-ghost" onClick={close}>{t('common.cancel')}</button>
            {!isNew ? <button type="button" className="btn btn-danger" onClick={() => void remove()}>{t('common.delete')}</button> : null}
          </div>
        </form>
        <div>
          <p className="hint">{t('editor.preview')}</p>
          <ul className="grid preview-grid" aria-label={t('editor.preview')}><ProductCard product={preview} preview /></ul>
        </div>
      </div>
    </div>
  );
}
