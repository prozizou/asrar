import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import * as hb from 'harfbuzzjs';
import { createShaper } from '../lib/alqalamShaper';
import { createOrnementSession } from '../lib/alqalamOrnementSession';
import { composePhrasePages, PHRASE_PIECE } from '../lib/alqalamOrne';
import { vectorizePage, pageSvgMarkup } from '../lib/alqalamVector';
import { buildOrnementSource, ORNEMENT_SOURCE_LIMIT } from '../lib/alqalamOrnementSource';
import { createOrnementClient } from '../lib/alqalamOrnementClient';

let shaper;
beforeAll(() => {
  const buf = fs.readFileSync(new URL('../public/fonts/ScheherazadeNew-Bold.ttf', import.meta.url));
  shaper = createShaper(hb, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const input = { phrase: 'بسم الله الرحمن الرحيم', letters: ['م', 'ه'], innerText: 'اللهم ارزقني رزقا واسعا', scale: 1 };

describe('Composition de l’ornement hors interface', () => {
  it('conserve exactement le SVG et la géométrie utilisés par le PDF', () => {
    const session = createOrnementSession(shaper);
    const meta = session.compose(input);
    const direct = composePhrasePages({ ...input, measure: shaper.measure });
    const vector = vectorizePage(direct.pages[0], shaper, { idPrefix: 'p0q' });
    expect(meta.pages).toEqual(direct.pages.map(() => null));
    expect(meta.pageCount).toBe(direct.pageCount);
    expect(session.vector(0)).toEqual(vector);
    expect(session.svg(0, 'Pièce')).toBe(pageSvgMarkup(vector, { pageNumber: 1, pageCount: direct.pages.length, label: 'Pièce', margin: PHRASE_PIECE.MARGIN }));
  });
  it('invalide les pages après un changement de vœu et refuse une page inexistante', () => {
    const session = createOrnementSession(shaper);
    session.compose(input);
    const first = session.svg(0, 'Test');
    session.compose({ ...input, innerText: 'يا رزاق' });
    expect(session.svg(0, 'Test')).not.toBe(first);
    expect(() => session.vector(999)).toThrow(/indisponible/);
  });
});

describe('Source de l’ornement bornée sans tronquer les documents', () => {
  const transforms = { plainText: html => html.replace(/<[^>]*>/g, ''), rasm: text => text.replace(/ب/g, 'ٮ') };
  it('préserve les espaces, la conversion Rasm et les contenus cumulés', () => {
    const result = buildOrnementSource([
      { texte: '<span>بسم</span>', totalMultiplier: 2, isRasmMode: true },
      { texte: 'الله', totalMultiplier: 3, plain: true },
    ], transforms);
    expect(result.text).toBe('ٮسم ٮسم  الله الله الله');
    // La détection des lettres ne dépend pas du nombre de répétitions.
    expect(result.detectionText).toBe('ٮسم الله');
  });
  it('signale la limite avant de développer une répétition énorme, sans modifier la source', () => {
    const block = { texte: 'الله', totalMultiplier: Number.MAX_SAFE_INTEGER, plain: true };
    expect(buildOrnementSource([block], transforms)).toBeNull();
    expect(block.totalMultiplier).toBe(Number.MAX_SAFE_INTEGER);
    expect(buildOrnementSource([{ texte: 'م', totalMultiplier: 30000, plain: true }], transforms).text.length).toBeLessThan(ORNEMENT_SOURCE_LIMIT);
  });
});

describe('Cycle de vie du Worker', () => {
  function mockWorker() {
    const instances = [];
    class FakeWorker {
      listeners = {};
      sent = [];
      terminated = false;
      constructor() { instances.push(this); }
      addEventListener(type, fn) { this.listeners[type] = fn; }
      removeEventListener(type) { delete this.listeners[type]; }
      postMessage(message) { this.sent.push(message); }
      terminate() { this.terminated = true; }
    }
    vi.stubGlobal('Worker', FakeWorker);
    return instances;
  }
  it('associe chaque réponse à sa demande et annule les calculs périmés sans fuite de timer', async () => {
    vi.useFakeTimers();
    const workers = mockWorker(), client = createOrnementClient();
    const pending = client.compose(input);
    workers[0].listeners.message({ data: { id: 1, result: { pageCount: 1 } } });
    await expect(pending).resolves.toEqual({ pageCount: 1 });
    const rendering = client.svg(0, 'Page');
    const outcome = expect(rendering).rejects.toMatchObject({ name: 'AbortError' });
    client.dispose(); await outcome;
    expect(workers[0].terminated).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await expect(client.vector(0)).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('interrompt un Worker bloqué et libère toutes les requêtes', async () => {
    vi.useFakeTimers();
    const workers = mockWorker(), client = createOrnementClient();
    const outcome = expect(client.compose(input)).rejects.toThrow(/trop de temps/);
    await vi.advanceTimersByTimeAsync(60001); await outcome;
    expect(workers[0].terminated).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
