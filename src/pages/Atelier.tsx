import { useFormat } from '../format';
import { Link, usePage } from '../shared/router';

const img = (name: string) => `${import.meta.env.BASE_URL}img/${name}`;

export default function Atelier() {
  const { t } = useFormat();
  usePage(t('title.atelier'));
  return (
    <div className="wrap narrow view prose">
      <Link className="back-link" to="/">{t('checkout.back')}</Link>
      <h1 tabIndex={-1}>{t('atelier.title')}</h1>
      <p className="lead">{t('atelier.lead')}</p>
      <img src={img('atelier-1100.webp')} width="1100" height="825" loading="lazy" decoding="async" alt={t('atelier.photoAlt2')} />
      <h2>{t('atelier.h1')}</h2>
      <p>{t('atelier.p1')}</p>
      <h2>{t('atelier.h2')}</h2>
      <ul><li>{t('atelier.care1')}</li><li>{t('atelier.care2')}</li><li>{t('atelier.care3')}</li></ul>
      <h2>{t('atelier.h3')}</h2>
      <p>{t('atelier.p3')}</p>
      <p><Link className="btn btn-primary" to="/">{t('hero.shop')}</Link></p>
    </div>
  );
}
