// Display helpers that depend on the current language: money from cents, bilingual product text,
// labels of glazes, categories and order statuses.
import { useCallback } from 'react';
import type { CategoryId, GlazeId, OrderStatus, ShapeId } from './domain/catalog';
import type { Product } from './domain/schema';
import { useI18n, type Key } from './i18n';

export function useFormat() {
  const i18n = useI18n();
  const { t, lang, locale } = i18n;
  const price = useCallback((cents: number) => i18n.money(cents / 100, cents % 100 ? 2 : 0), [i18n]);
  const cents = useCallback((cents: number) => i18n.money(cents / 100, 2), [i18n]);
  const name = useCallback((p: { name: Product['name'] }) => p.name[lang] || p.name.fr, [lang]);
  const desc = useCallback((p: Pick<Product, 'desc'>) => p.desc[lang] || p.desc.fr, [lang]);
  const glaze = useCallback((g: GlazeId) => t(`glaze.${g}` as Key), [t]);
  const category = useCallback((c: CategoryId) => t(`cat.${c}` as Key), [t]);
  const shape = useCallback((s: ShapeId) => t(`shape.${s}` as Key), [t]);
  const status = useCallback((s: OrderStatus) => t(`status.${s}` as Key), [t]);
  const dateTime = useCallback((iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)), [locale]);
  const artLabel = useCallback((p: { name: Product['name'] }, g: GlazeId) => t('art.label', { name: p.name[lang] || p.name.fr, glaze: t(`glaze.${g}` as Key) }), [t, lang]);
  return { ...i18n, price, cents, name, desc, glaze, category, shape, status, dateTime, artLabel };
}
