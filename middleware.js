// middleware.js — Nonce CSP par requête pour script-src.
//
// Ferme le compromis 'unsafe-inline' sur script-src (documenté dans
// lib/csp.js) : un nonce aléatoire est généré à chaque requête, exposé à
// app/layout.js via l'en-tête interne x-nonce (next/headers) pour le
// <script> anti-FOUC, et posé dans la CSP de la réponse à la place de
// 'unsafe-inline'. IMPORTANT : Next.js ne fusionne PAS deux en-têtes
// Content-Security-Policy de même nom — celui posé ici REMPLACE
// entièrement celui de next.config.mjs sur les routes couvertes (constaté :
// n'y mettre QUE script-src supprimait tout le reste de la politique,
// connect-src/img-src/frame-src compris → app cassée). D'où buildCsp(nonce)
// qui renvoie la politique COMPLÈTE.
//
// Effet de bord accepté : lire headers() dans app/layout.js (pour le nonce)
// fait basculer TOUTES les pages en rendu dynamique (plus de prérendu
// statique) — comportement documenté de Next.js App Router pour ce pattern.
// Impact réel limité ici : la quasi-totalité des pages sont déjà 'use
// client' et rendent leur contenu après coup via Firebase (cf. ANALYSE.md,
// faiblesse « surface use client ») — le HTML prérendu n'était donc déjà
// qu'une coquille de chargement, pas du contenu prêt à l'affichage.
import { NextResponse } from 'next/server';
import { buildCsp } from '@/lib/csp';

export function middleware(request) {
  const nonce = crypto.randomUUID().replace(/-/g, '');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', buildCsp(nonce));
  return response;
}

// Toutes les routes de page (pas les assets _next, ni les fonctions /api qui
// ne posent pas de script inline et n'ont pas besoin du nonce).
export const config = {
  matcher: ['/((?!_next/static|_next/image|api/|favicon.ico|assets/).*)'],
};
