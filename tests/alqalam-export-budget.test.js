import { describe, expect, it } from 'vitest';
import { checkExportBudget, MAX_EXPORT_CHARS } from '../lib/alqalamExport';

describe('Volume des exports Al-Qalam', () => {
  it('compte les répétitions et les cadres, sans construire le texte complet', () => {
    expect(checkExportBudget([{ unitText: 'الله ', totalMultiplier: 30000 }], 'بسم ', ' آمين')).toBe(150009);
    expect(checkExportBudget([{ unitText: 'م', totalMultiplier: MAX_EXPORT_CHARS }])).toBe(MAX_EXPORT_CHARS);
  });
  it('refuse un document démesuré et les répétitions invalides avant compression ou impression', () => {
    expect(() => checkExportBudget([{ unitText: 'الله', totalMultiplier: Number.MAX_SAFE_INTEGER }])).toThrow(/volumineux/);
    expect(() => checkExportBudget([{ unitText: 'م', totalMultiplier: 1 }], '', '', MAX_EXPORT_CHARS)).toThrow(/volumineux/);
    expect(() => checkExportBudget([{ unitText: 'م', totalMultiplier: 1.5 }])).toThrow(/répétitions/);
  });
});
