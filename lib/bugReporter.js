'use client';
// lib/bugReporter.js — Envoi des bugs et lenteurs vers /api/client-error
// (enregistrés pour l'onglet « Bugs » de l'administration).
//
// Les rapports automatiques sont mis en file puis envoyés par lots (toutes les
// 5 s, et quand l'application passe en arrière-plan). Garde-fous côté client,
// pour ne jamais alourdir l'application ni inonder le serveur :
//   • un même bug (même message, même page) n'est envoyé que 3 fois par session ;
//   • 30 rapports automatiques au plus par session ;
//   • aucune erreur levée : l'envoi est toujours best-effort.
// fetch direct (pas apiPost) : pas d'idToken obligatoire (un plantage peut
// survenir avant la connexion) et aucune boucle si apiPost échoue lui-même.
import { auth } from './firebase';
import { isNoise } from './bugReport';

const FLUSH_MS = 5000;
const SESSION_MAX = 30;
const SAME_MAX = 3;
const RECENT_MAX = 5;

const queue = [];
const seen = new Map();
const recent = [];
let sent = 0;
let timer = null;
let version = '';

function currentPage() {
  return typeof window === 'undefined' ? '/' : window.location.pathname;
}

// Version de l'app : celle du service worker actif (même source que le menu).
function loadVersion() {
  if (version || typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return;
  try {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => { version = String(event.data?.version || ''); channel.port1.close(); };
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  } catch { /* version facultative */ }
}

async function idToken() {
  try { return auth.currentUser ? await auth.currentUser.getIdToken() : undefined; } catch { return undefined; }
}

async function post(reports) {
  loadVersion();
  const body = { reports: reports.map((r) => ({ ...r, version: r.version || version || process.env.NEXT_PUBLIC_APP_VERSION || '' })), idToken: await idToken() };
  const r = await fetch('/api/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  });
  return r.ok;
}

export function flushBugReports() {
  clearTimeout(timer); timer = null;
  if (!queue.length) return;
  post(queue.splice(0, 10)).catch(() => {});
  if (queue.length) schedule();
}

function schedule() {
  if (!timer) timer = setTimeout(flushBugReports, FLUSH_MS);
}

/**
 * Met en file un rapport automatique.
 * @param {{kind?: 'error'|'lag', message: string, stack?: string, label?: string, durationMs?: number, page?: string}} report
 */
export function reportBug(report) {
  if (typeof window === 'undefined' || !report || !report.message) return;
  const kind = report.kind === 'lag' ? 'lag' : 'error';
  if (kind === 'error' && isNoise(report.message, report.stack)) return;
  const page = report.page || currentPage();
  const key = kind + '|' + (report.label || report.message).slice(0, 120) + '|' + page;
  const count = (seen.get(key) || 0) + 1;
  seen.set(key, count);
  if (count > SAME_MAX || sent >= SESSION_MAX) return;
  sent++;
  const entry = {
    kind,
    message: String(report.message).slice(0, 300),
    stack: String(report.stack || '').slice(0, 3000),
    label: report.label || '',
    durationMs: report.durationMs || 0,
    page,
  };
  recent.push({ kind, message: entry.message, page, at: Date.now() });
  if (recent.length > RECENT_MAX) recent.shift();
  queue.push(entry);
  schedule();
}

/** Erreur JavaScript (Error ou valeur quelconque). */
export function reportException(error, label = '') {
  const message = (error && error.message) || (typeof error === 'string' ? error : '') || String(error || '');
  reportBug({ kind: 'error', message: (label ? label + ' : ' : '') + message, stack: error?.stack, label });
}

/** Lenteur mesurée (durée en millisecondes). */
export function reportLag(label, durationMs, message) {
  reportBug({ kind: 'lag', label, durationMs: Math.round(durationMs), message: message || label });
}

/** Derniers problèmes détectés dans la session (joints à un signalement). */
export function recentProblems() {
  return recent.slice();
}

/**
 * Signalement écrit par l'utilisateur, envoyé immédiatement.
 * @param {string} description
 * @param {{withContext?: boolean}} [options]
 * @returns {Promise<boolean>} true si le serveur a bien reçu le signalement
 */
export async function sendUserReport(description, { withContext = true } = {}) {
  let detail = String(description || '').trim().slice(0, 800);
  if (!detail) return false;
  if (withContext) {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const lines = [];
    const screenSize = typeof window !== 'undefined' ? window.innerWidth + '×' + window.innerHeight : '';
    if (screenSize) lines.push('Écran : ' + screenSize + (nav.onLine === false ? ' · hors ligne' : ''));
    for (const p of recent) lines.push('Problème détecté : ' + p.message.slice(0, 80) + ' (' + p.page + ')');
    if (lines.length) detail += '\n\n— Informations techniques —\n' + lines.join('\n');
  }
  try {
    return await post([{ kind: 'user', message: 'Signalement', detail: detail.slice(0, 1000), page: currentPage() }]);
  } catch {
    return false;
  }
}
