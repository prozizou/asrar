import { describe, it, expect } from 'vitest';
import { decideBack } from './androidBack';

describe('decideBack (bouton retour Android)', () => {
  it('ferme d’abord une fenêtre, puis une fiche', () => {
    expect(decideBack({ path: '/zikr', dialogOpen: true, panelOpen: true })).toEqual({ action: 'close-dialog' });
    expect(decideBack({ path: '/', panelOpen: true })).toEqual({ action: 'close-panel' });
  });
  it('ramène tout module, même une sous-page, directement au menu', () => {
    for (const path of ['/planete', '/wafq/carre', '/wafq/carre/7', '/menu/outils', '/asrar', '/commandes', '/compte/']) {
      expect(decideBack({ path })).toEqual({ action: 'navigate', to: '/menu' });
    }
  });
  it('du menu au Marché, et sortie depuis le Marché', () => {
    expect(decideBack({ path: '/menu' })).toEqual({ action: 'navigate', to: '/' });
    expect(decideBack({ path: '/menu/' })).toEqual({ action: 'navigate', to: '/' });
    expect(decideBack({ path: '/' })).toEqual({ action: 'exit' });
    expect(decideBack({ path: '' })).toEqual({ action: 'exit' });
  });
});
