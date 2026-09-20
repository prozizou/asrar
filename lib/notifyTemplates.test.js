import { describe, it, expect } from 'vitest';
import { truncate, secretNotification, documentNotification, zikrMessageNotification, NOTIF_TYPES } from './notifyTemplates';

describe('truncate', () => {
  it('renvoie le texte tel quel sous la limite', () => {
    expect(truncate('Bonjour', 20)).toBe('Bonjour');
  });

  it('coupe sur un mot entier et ajoute …', () => {
    const long = 'Un texte assez long pour dépasser la limite fixée ici';
    const out = truncate(long, 20);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(21);
    expect(out).not.toMatch(/\s…$/); // pas d'espace juste avant les points de suspension
  });

  it('coupe brutalement si aucun espace exploitable', () => {
    const out = truncate('a'.repeat(50), 10);
    expect(out).toBe('a'.repeat(10) + '…');
  });

  it('gère undefined/null sans planter', () => {
    expect(truncate(undefined, 10)).toBe('');
    expect(truncate(null, 10)).toBe('');
  });
});

describe('secretNotification', () => {
  it('formate le titre avec le nom de l’expéditeur', () => {
    const n = secretNotification({ senderName: 'Mamadou Ndiaye', preview: 'Un secret de protection' });
    expect(n.type).toBe(NOTIF_TYPES.SECRET);
    expect(n.title).toBe('Nouveau Secret reçu de Mamadou Ndiaye');
    expect(n.body).toBe('Un secret de protection');
  });

  it('replie sur ASRAR PRO si aucun expéditeur fourni', () => {
    const n = secretNotification({});
    expect(n.title).toBe('Nouveau Secret reçu de ASRAR PRO');
    expect(n.body).toBe('Un nouveau Secret est disponible.');
  });
});

describe('documentNotification', () => {
  it('formate le titre « X vous a envoyé un document »', () => {
    const n = documentNotification({ senderName: 'Fatou', preview: 'Traité de géomancie' });
    expect(n.type).toBe(NOTIF_TYPES.DOCUMENT);
    expect(n.title).toBe('Fatou vous a envoyé un document');
    expect(n.body).toBe('Traité de géomancie');
  });

  it('replie sur un texte générique sans aperçu', () => {
    const n = documentNotification({ senderName: 'Fatou' });
    expect(n.body).toBe('Un nouveau document est disponible.');
  });
});

describe('zikrMessageNotification', () => {
  it('formate le titre « Nouveau message de X »', () => {
    const n = zikrMessageNotification({ senderName: 'Abdou', preview: 'Salam à tous' });
    expect(n.type).toBe(NOTIF_TYPES.ZIKR_MESSAGE);
    expect(n.title).toBe('Nouveau message de Abdou');
    expect(n.body).toBe('Salam à tous');
  });

  it('distingue pièce jointe / texte pour le repli sans aperçu', () => {
    expect(zikrMessageNotification({ senderName: 'Abdou', hasMedia: true }).body).toBe('a envoyé une pièce jointe.');
    expect(zikrMessageNotification({ senderName: 'Abdou', hasMedia: false }).body).toBe('a envoyé un message.');
  });

  it('replie sur « Un membre » sans nom', () => {
    expect(zikrMessageNotification({}).title).toBe('Nouveau message de Un membre');
  });
});
