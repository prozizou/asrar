import { describe, it, expect } from 'vitest';
import { whatsappAppUrl } from './externalWindow';

describe('Lien WhatsApp ouvert dans l’application', () => {
  it('convertit wa.me en whatsapp:// avec numéro et message (emojis et accents conservés)', () => {
    const text = 'Assalamou aleykoum 🌙\n*DEMANDE DE DISPONIBILITÉ*\n📦 Article : L’encre & 50 %';
    const url = whatsappAppUrl('https://wa.me/221770000000?text=' + encodeURIComponent(text));
    expect(url).toBe('whatsapp://send?phone=221770000000&text=' + encodeURIComponent(text));
    expect(decodeURIComponent(url.split('text=')[1])).toBe(text);
  });
  it('accepte api.whatsapp.com et un lien sans message', () => {
    expect(whatsappAppUrl('https://api.whatsapp.com/send?phone=%2B221%2077&text=Salut')).toBe('whatsapp://send?phone=22177&text=Salut');
    expect(whatsappAppUrl('https://wa.me/22100000000')).toBe('whatsapp://send?phone=22100000000');
  });
  it('ignore les autres liens', () => {
    for (const href of ['https://example.com/wa.me/1', 'http://wa.me/1', 'https://evil.wa.me.example/1', 'not a url', '/api/wa?text=x']) {
      expect(whatsappAppUrl(href)).toBeNull();
    }
  });
});
