import { describe, expect, it } from 'vitest';
import { parseCspReports, firebaseKey, MAX_REPORTS } from './cspReport';

const own = (host) => host === 'www.asrarpro.com';

describe('Rapports CSP (lib/cspReport.js)', () => {
  it('lit le format report-uri (Firefox, Safari) : directive et domaine seulement', () => {
    const body = { 'csp-report': {
      'document-uri': 'https://www.asrarpro.com/asrar?cat=protection',
      'blocked-uri': 'https://cdn.ads-example.net/tag/v2.js?uid=secret',
      'violated-directive': "script-src-elem 'self' https://bicea.org",
    } };
    expect(parseCspReports(body, own)).toEqual([{ directive: 'script-src-elem', blocked: 'cdn.ads-example.net' }]);
  });

  it('lit le format Reporting API (Chrome) et ignore les autres types de rapports', () => {
    const body = [
      { type: 'csp-violation', body: { documentURL: 'https://www.asrarpro.com/', blockedURL: 'https://track.example.org/pixel', effectiveDirective: 'connect-src' } },
      { type: 'deprecation', body: { documentURL: 'https://www.asrarpro.com/' } },
      { type: 'csp-violation', body: { documentURL: 'https://www.asrarpro.com/', blockedURL: 'inline', effectiveDirective: 'style-src-attr' } },
    ];
    expect(parseCspReports(body, own)).toEqual([
      { directive: 'connect-src', blocked: 'track.example.org' },
      { directive: 'style-src-attr', blocked: 'inline' },
    ]);
  });

  it('ignore les rapports d’autres sites, les directives inconnues et les corps invalides', () => {
    expect(parseCspReports({ 'csp-report': { 'document-uri': 'https://evil.example/', 'blocked-uri': 'https://x.example/', 'violated-directive': 'script-src' } }, own)).toEqual([]);
    expect(parseCspReports({ 'csp-report': { 'document-uri': 'https://www.asrarpro.com/', 'blocked-uri': 'https://x.example/', 'violated-directive': 'n-importe-quoi' } }, own)).toEqual([]);
    for (const body of [null, 'texte', 42, {}, [], [{ type: 'csp-violation' }]]) expect(parseCspReports(body, own)).toEqual([]);
  });

  it('classe les blocages qui ne sont pas des URL (extensions, data:, valeurs bizarres)', () => {
    const report = (blocked) => ({ 'csp-report': { 'document-uri': 'https://www.asrarpro.com/', 'blocked-uri': blocked, 'effective-directive': 'img-src' } });
    expect(parseCspReports(report('chrome-extension://abc/x.js'), own)[0].blocked).toBe('chrome-extension');
    expect(parseCspReports(report('data'), own)[0].blocked).toBe('data');
    expect(parseCspReports(report('eval'), own)[0].blocked).toBe('eval');
    expect(parseCspReports(report('<script>'), own)[0].blocked).toBe('inconnu');
    expect(parseCspReports(report(''), own)[0].blocked).toBe('inconnu');
  });

  it('borne le nombre de rapports par envoi et produit des clés Firebase valides', () => {
    const one = { type: 'csp-violation', body: { documentURL: 'https://www.asrarpro.com/', blockedURL: 'https://a.b.example/', effectiveDirective: 'frame-src' } };
    expect(parseCspReports(Array(100).fill(one), own)).toHaveLength(MAX_REPORTS);
    expect(firebaseKey('a.b.example')).toBe('a,b,example');
  });
});
