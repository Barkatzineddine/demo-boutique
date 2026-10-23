// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, GLAZE_IDS, ORDER_STATUSES, SHAPE_IDS } from '../../src/domain/catalog';
import { dictionaries } from '../../src/i18n';
import { interpolate } from '../../src/shared/i18n';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  const fr = Object.entries(dictionaries.fr);
  it('has every French key in English, and nothing more', () => {
    expect(Object.keys(dictionaries.en).sort()).toEqual(fr.map(([k]) => k).sort());
  });
  it('has no empty string and the same placeholders in both languages', () => {
    for (const [k, v] of fr) {
      expect(v.trim(), k).not.toBe('');
      expect(placeholders(dictionaries.en[k as keyof typeof dictionaries.en]), k).toEqual(placeholders(v));
    }
  });
  it('names every category, glaze, shape and status (keys built at run time)', () => {
    const keys = new Set(Object.keys(dictionaries.fr));
    for (const id of CATEGORY_IDS) expect(keys.has(`cat.${id}`), id).toBe(true);
    for (const id of GLAZE_IDS) expect(keys.has(`glaze.${id}`), id).toBe(true);
    for (const id of SHAPE_IDS) expect(keys.has(`shape.${id}`), id).toBe(true);
    for (const id of ORDER_STATUSES) expect(keys.has(`status.${id}`), id).toBe(true);
  });
  it('interpolates values', () => {
    expect(interpolate('{n} pièce(s)', { n: 3 })).toBe('3 pièce(s)');
  });
});
