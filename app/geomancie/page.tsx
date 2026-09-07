'use client';
// Module « Géomancie (Tourab) » — port de geomancie/tourab.html.
// Saisie des 4 Mères (lignes à 1 ou 2 points) → calcul de l'écu (16 Maisons),
// figures binaires, بزدح, parité du Juge, synthèse (vœu / repérage) et modale
// d'interprétation par maison. La logique vit dans lib/geomancie.js ; ici l'UI
// React et les données premium (via /api/get-theme, réservées au forfait 1 An —
// PREMIUM_LEVEL — vérifié côté client (ensureAccess) ET côté serveur (get-theme)).
//
// Revue design v2 : la page ressemblait à un prototype de calcul (16 petites
// cartes toutes de même poids visuel, couleur d'accent utilisée PARTOUT —
// titres, points, contours, badges —, halos et ombres marqués, 3 boutons
// concurrents, case de géolocalisation en pleine largeur au milieu du flux).
// Reprise en : résultat (Juge/Sentence/Vœu) affiché EN PREMIER après le
// calcul, écu complet replié dans un diagramme par paliers (Mères → Filles →
// Nièces → Témoins → Verdict, tailles progressives), hiérarchie de boutons à
// 3 niveaux, confidentialité repliée derrière une icône, et un seul jeu
// d'icônes vectorielles (lucide) à la place des emoji.
//
// TypeScript (batch 5/7, cf. tsconfig.json) : lib/geomancie.js reste en .js
// (hors scope de ce batch) — ses valeurs de retour (mères, maisons, figures)
// restent typées `any`/`number[][]` en local plutôt que reproduites en
// interfaces (forme interne complexe, propre à ce module), même principe que
// lib/rouwhania.js dans le batch précédent (#120). useAccess()/Spinner.js
// suivent le même traitement (cast) que dans les batches précédents (#114,
// #116, #118, #120).
import './geomancie.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { useAccess } from '@/components/AccessProvider';
import SpinnerUntyped from '@/components/Spinner';
import { PREMIUM_LEVEL } from '@/lib/access';
import {
  generateAllHouses,
  checkJudgeParity,
  synthesis,
  getCleanName,
  figToKey,
  getBZDHValue,
  figureData,
  houseNames,
  houseModalData,
  randomMothers,
  neutralMothers,
} from '@/lib/geomancie';
import {
  Shield,
  Moon,
  Sparkles,
  Dices,
  RotateCcw,
  Lock,
  MapPin,
  Scale,
  ScrollText,
  Star,
  Eye,
  ChevronDown,
  ArrowDown,
} from 'lucide-react';

const Spinner = SpinnerUntyped as any;

type Figure = number[]; // 4 lignes, chacune à 1 ou 2 points
type Mothers = Figure[]; // les 4 Mères
type Size = 'sm' | 'md' | 'lg';

// Clé de consentement distinct (localStorage, par appareil) — voir shareLocation
// ci-dessous. Choix explicite du terme "share" plutôt que "geo" seul : couvre
// aussi une éventuelle extension future (ville déclarée, etc.).
const GEO_CONSENT_KEY = 'geomancie_share_location';

// Arrondit à ~11 km (1 décimale) — assez pour une carte régionale côté admin,
// sans jamais transmettre de position précise (revue de sécurité, § géoloc).
function roundApprox(v: number) {
  return Math.round(v * 10) / 10;
}

// Journalise l'usage de la géomancie (suivi admin), avec localisation
// APPROXIMATIVE et SEULEMENT si l'utilisateur l'a explicitement autorisé
// (`shareLocation`, coché par défaut à FALSE — voir le bouton dédié dans le
// panneau). Avant ce correctif, `getCurrentPosition` (position PRÉCISE)
// était appelé automatiquement à chaque calcul, sans consentement séparé de
// l'accès général à l'app, puis stocké avec uid+email (pages/api/track.js) —
// revue de sécurité, point P0.
function logGeomancie(shareLocation: boolean) {
  const user = auth.currentUser;
  if (!user) return;
  const send = (lat: number | null, lng: number | null) =>
    user
      .getIdToken()
      .then((idToken: string) =>
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, type: 'geomancie', page: 'geomancie', lat, lng }),
        })
      )
      .catch(() => {});
  if (shareLocation && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (p) => send(roundApprox(p.coords.latitude), roundApprox(p.coords.longitude)),
      () => send(null, null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  } else {
    send(null, null);
  }
}

// Paliers de l'écu, dans l'ordre naturel de lecture française (revue design,
// point 3 : « M8 → M1 est contre-intuitif ») — M1 → M16, plutôt que l'ordre
// M8 → M1 hérité de la mise en page d'origine. Rien dans ce module ni dans
// lib/geomancie.js ne documente cet ordre inversé comme une convention
// traditionnelle à préserver : c'est un pur choix d'affichage (l'index des
// maisons dans `houses[]`, lui, ne change pas). Tailles progressives (sm →
// lg) : les figures gagnent en importance visuelle à mesure qu'on approche
// du verdict (revue design, point 1).
const TIERS: { key: string; label: string; indices: number[]; size: Size }[] = [
  { key: 'meres', label: 'Mères', indices: [0, 1, 2, 3], size: 'sm' },
  { key: 'filles', label: 'Filles', indices: [4, 5, 6, 7], size: 'sm' },
  { key: 'nieces', label: 'Nièces', indices: [8, 9, 10, 11], size: 'md' },
  { key: 'temoins', label: 'Témoins', indices: [12, 13], size: 'md' },
  { key: 'verdict', label: 'Verdict', indices: [14, 15], size: 'lg' },
];

function MiniFigure({ fig, size = 'sm', tone }: { fig: Figure; size?: Size; tone?: 'brand' }) {
  return (
    <div className={'mini-figure size-' + size + (tone ? ' tone-' + tone : '')}>
      {fig.map((count, r) => (
        <div className="mini-row" key={r}>
          {Array.from({ length: count }).map((_, d) => (
            <span className="mini-dot" key={d} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function GeomanciePage() {
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { ensureAccess, openGate } = useAccess() as unknown as {
    ensureAccess: (minLevel?: number) => Promise<boolean>;
    openGate: (reason?: string | null) => void;
  };

  const [mothers, setMothers] = useState<Mothers>(neutralMothers);
  const [calculated, setCalculated] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [fbData, setFbData] = useState<any[]>([]);
  const [activeFig, setActiveFig] = useState<string | null>(null);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  // Écu complet replié par défaut après un calcul (revue design, point 4 :
  // le résultat doit apparaître AVANT les détails) — rouvert automatiquement
  // quand on touche le Vœu/la Figure de repérage, pour que la maison mise en
  // évidence (voir highlightFigure) reste visible sans manipulation en plus.
  const [shieldOpen, setShieldOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Consentement distinct pour la localisation (voir logGeomancie) — lu APRÈS
  // le premier rendu (localStorage indisponible en SSR), donc décoché par
  // défaut tant que l'effet n'a pas tourné : jamais activé silencieusement.
  const [shareLocation, setShareLocation] = useState(false);
  useEffect(() => {
    try {
      setShareLocation(localStorage.getItem(GEO_CONSENT_KEY) === 'true');
    } catch {}
  }, []);
  const toggleShareLocation = () => {
    setShareLocation((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(GEO_CONSENT_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const houses = useMemo<any[]>(() => generateAllHouses(mothers), [mothers]);
  const synth = calculated ? synthesis(houses) : null;
  const parity = calculated ? checkJudgeParity(houses) : null;

  // Juge (M15) et Sentence (M16) — les deux figures qui portent le verdict
  // (revue design, point 4 : « le résultat manque de dominance »). La
  // Sentence combine déjà le Juge et l'Âme (M1, voir lib/geomancie.js) : elle
  // reste la réponse la plus aboutie de l'écu, affichée juste après le Juge
  // plutôt que noyée au milieu des 16 maisons.
  const judgeKey = calculated ? figToKey(houses[14]) : null;
  const judgeData = judgeKey ? figureData(judgeKey, fbData) : null;
  const sentenceKey = calculated ? figToKey(houses[15]) : null;

  const showToast = useCallback((msg: string) => {
    setToast({ id: Date.now(), msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // Échap ferme la modale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalIndex(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleMotherRow = (mi: number, ri: number) => {
    setMothers((prev) => {
      const next = prev.map((row) => [...row]);
      next[mi][ri] = next[mi][ri] === 1 ? 2 : 1;
      return next;
    });
    setActiveFig(null); // clearPassation
  };

  const fetchFirebaseData = useCallback(async () => {
    try {
      const res = await apiPost('get-theme');
      setFbData(res.data || []);
      showToast('Données chargées.');
      return res.data || [];
    } catch (error: any) {
      if (error && error.status === 403) {
        showToast('Géomancie réservée au forfait 1 An (45 000 FCFA).');
        openGate('level');
      } else {
        showToast('Échec du chargement (' + (error.message || 'erreur') + ').');
      }
      return null;
    }
  }, [showToast, openGate]);

  const onCalculate = async () => {
    const ok = await ensureAccess(PREMIUM_LEVEL);
    if (!ok) return;
    setCalculating(true);
    try {
      if (!fbData || fbData.length === 0) await fetchFirebaseData();
      setCalculated(true);
      setActiveFig(null);
      setShieldOpen(false);
      logGeomancie(shareLocation);
    } finally {
      setCalculating(false);
    }
  };

  const onRandom = () => {
    setMothers(randomMothers());
    setCalculated(false);
    setActiveFig(null);
    setShieldOpen(false);
  };

  const onReset = () => {
    setMothers(neutralMothers());
    setCalculated(false);
    setActiveFig(null);
    setShieldOpen(false);
    showToast('Thème réinitialisé.');
  };

  const openHouseModal = (idx: number) => {
    if (!calculated) return;
    setActiveFig(figToKey(houses[idx]));
    setModalIndex(idx);
  };

  const closeModal = () => {
    setModalIndex(null);
    setActiveFig(null);
  };

  const highlightFigure = (figKey: string) => {
    const count = houses.filter((h) => figToKey(h) === figKey).length;
    const name = getCleanName(figKey, fbData);
    if (count > 0) {
      setActiveFig(figKey);
      setShieldOpen(true); // la maison mise en évidence doit rester visible
      showToast(`${name} présente dans ${count} maison(s).`);
    } else {
      setActiveFig(null);
      showToast(`${name} absente de l'écu.`);
    }
  };

  return (
    <div className="geo-page">
      <div className="app-container">
        {/* Barre compacte (revue design, point « repenser le bandeau
            supérieur ») — remplace le grand bandeau « ✦ Asrar Pro ✦ » qui
            consommait tout un écran avant même les 4 Mères. */}
        <div className="geo-topbar">
          <Link href="/" className="btn geo-back">
            ← Retour
          </Link>
          <div className="geo-topbar-title">
            <Shield size={18} strokeWidth={2} aria-hidden="true" />
            Géomancie
          </div>
        </div>

        {/* Les Quatre Mères */}
        <div className="panel">
          <h2>
            <Moon size={16} strokeWidth={2} aria-hidden="true" /> Les Quatre Mères
          </h2>
          <div className="mothers-grid">
            {mothers.map((fig, mi) => (
              <div className="mother-card" key={mi}>
                <div className="mother-label">Mère {mi + 1}</div>
                <div className="figure-display">
                  {fig.map((count, ri) => (
                    <div
                      className={'dot-row' + (count === 2 ? ' double-row' : '')}
                      key={ri}
                      onClick={() => toggleMotherRow(mi, ri)}
                    >
                      {Array.from({ length: count }).map((_, d) => (
                        <span className="dot" key={d} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Hiérarchie à 3 niveaux (revue design, point « boutons sans
              hiérarchie ») : Calculer (plein, dominant) → Générer
              aléatoirement (contour) → Réinitialiser (texte seul). */}
          <div className="btn-stack">
            <button className="btn btn-primary" onClick={onCalculate} disabled={calculating}>
              {calculating ? (
                <>
                  <Spinner /> Calcul…
                </>
              ) : (
                <>
                  <Sparkles size={17} strokeWidth={2} aria-hidden="true" /> Calculer l'Écu
                </>
              )}
            </button>
            <button className="btn btn-secondary" onClick={onRandom}>
              <Dices size={16} strokeWidth={2} aria-hidden="true" /> Générer aléatoirement
            </button>
            <button className="btn btn-text" onClick={onReset}>
              <RotateCcw size={14} strokeWidth={2} aria-hidden="true" /> Réinitialiser
            </button>
          </div>

          {/* Confidentialité repliée (revue design, point « la case de
              localisation casse l'univers graphique ») — une simple
              divulgation derrière une icône, plus une ligne pleine largeur
              au milieu du parcours géomantique. */}
          <details className="privacy-disclosure">
            <summary>
              <Lock size={13} strokeWidth={2} aria-hidden="true" /> Confidentialité
            </summary>
            <label className="geo-consent-row">
              <input type="checkbox" checked={shareLocation} onChange={toggleShareLocation} />
              <span>
                <MapPin size={13} strokeWidth={2} aria-hidden="true" /> Partager ma position approximative
                (statistiques anonymisées, jamais précise)
              </span>
            </label>
          </details>
        </div>

        {calculating && (
          <div className="panel">
            <p className="placeholder-text">
              <Spinner /> Calcul de l'écu en cours…
            </p>
          </div>
        )}

        {calculated && !calculating && (
          <>
            {/* RÉSULTAT DE L'ÉCU — zone dominante (revue design, point 4) :
                Juge, parité et Sentence AVANT les 16 maisons, pas après. */}
            <div className="panel result-panel">
              <h2 className="result-title">
                <Scale size={16} strokeWidth={2} aria-hidden="true" /> Résultat de l'écu
              </h2>

              <div className="result-judge" onClick={() => openHouseModal(14)}>
                <MiniFigure fig={houses[14]} size="lg" tone="brand" />
                <div className="result-judge-info">
                  <div className="result-judge-label">{houseNames[14]}</div>
                  <div className="result-judge-name">{getCleanName(judgeKey as string, fbData)}</div>
                  {parity && (
                    <span className={'parity-badge' + (parity.even ? ' ok' : ' warn')}>
                      {parity.even ? `Parité : ${parity.total} points (paire)` : 'Anomalie de parité'}
                    </span>
                  )}
                  {judgeData?.domaine && <p className="result-judge-domaine">{judgeData.domaine}</p>}
                  <p className="result-hint">Toucher pour l'interprétation complète ›</p>
                </div>
              </div>

              <div className="result-sentence" onClick={() => openHouseModal(15)}>
                <ScrollText size={15} strokeWidth={2} aria-hidden="true" />
                <span>
                  {houseNames[15]} — <strong>{getCleanName(sentenceKey as string, fbData)}</strong>
                </span>
                <MiniFigure fig={houses[15]} size="sm" />
              </div>
            </div>

            {/* Vœu + Figure de repérage — l'or reste réservé au Vœu (revue
                design, point « couleur verte partout ») : c'est le seul
                élément explicitement qualifié de spirituel dans la revue. */}
            {synth && (
              <div className="synthesis-container">
                <div className="synthesis-card voeu" onClick={() => highlightFigure(synth.voeuKey)}>
                  <h4>
                    <Star size={15} strokeWidth={2} aria-hidden="true" /> Le vœu
                  </h4>
                  <MiniFigure fig={synth.voeuFig} />
                  <p>{getCleanName(synth.voeuKey, fbData)}</p>
                </div>
                <div className="synthesis-card" onClick={() => highlightFigure(synth.repKey)}>
                  <h4>
                    <Eye size={15} strokeWidth={2} aria-hidden="true" /> Figure de repérage
                  </h4>
                  <MiniFigure fig={synth.repFig} />
                  <p>{getCleanName(synth.repKey, fbData)}</p>
                </div>
              </div>
            )}

            {/* Écu complet — replié par défaut, pour l'utilisateur qui veut
                examiner M1 à M16 (revue design, point 4). Diagramme par
                paliers plutôt qu'une grille plate (point 1) : Mères → Filles
                → Nièces → Témoins → Verdict, connectés par de simples flèches,
                tailles progressives. Ordre naturel M1 → M16 (point 3). */}
            <details
              className="panel shield-accordion"
              open={shieldOpen}
              onToggle={(e) => setShieldOpen(e.currentTarget.open)}
            >
              <summary>
                <Shield size={15} strokeWidth={2} aria-hidden="true" />
                Voir l'écu complet (M1 → M16)
                <ChevronDown size={14} strokeWidth={2} className="shield-chevron" aria-hidden="true" />
              </summary>

              <p className="order-note">
                Ordre M1 → M16 : Mères, Filles, Nièces, Témoins, puis le Verdict (Juge et Sentence).
              </p>

              {TIERS.map((tier, ti) => (
                <div key={tier.key}>
                  <div className={'tier' + (tier.key === 'verdict' ? ' tier-verdict' : '')}>
                    <div className="tier-label">{tier.label}</div>
                    <div className={'tier-row size-' + tier.size}>
                      {tier.indices.map((idx) => (
                        <HouseCell
                          key={idx}
                          idx={idx}
                          fig={houses[idx]}
                          fbData={fbData}
                          size={tier.size}
                          active={activeFig != null && figToKey(houses[idx]) === activeFig}
                          onOpen={openHouseModal}
                        />
                      ))}
                    </div>
                  </div>
                  {ti < TIERS.length - 1 && (
                    <div className="tier-connector" aria-hidden="true">
                      <ArrowDown size={16} strokeWidth={2} />
                    </div>
                  )}
                </div>
              ))}
            </details>
          </>
        )}

        {!calculated && !calculating && (
          <div className="panel">
            <p className="placeholder-text">
              Saisissez les Mères et touchez <strong>Calculer l'Écu</strong>.
            </p>
          </div>
        )}
      </div>

      {modalIndex != null && (
        <HouseModal data={houseModalData(modalIndex, houses, fbData)} onClose={closeModal} />
      )}

      {toast && <div className="geo-toast">{toast.msg}</div>}
    </div>
  );
}

function HouseCell({
  idx,
  fig,
  fbData,
  active,
  onOpen,
  size,
}: {
  idx: number;
  fig: Figure;
  fbData: any[];
  active: boolean;
  onOpen: (idx: number) => void;
  size: Size;
}) {
  const cls =
    'house-cell size-' +
    size +
    (idx === 14 ? ' judge-cell' : '') +
    (idx === 15 ? ' sentence-cell' : '') +
    (active ? ' voie-active' : '');
  return (
    <div className={cls} onClick={() => onOpen(idx)}>
      {/* Repère discret (revue design, point 2) : le numéro de maison passe
          avant la figure mais reste un simple repère, jamais un badge
          voyant — la figure et le nom restent l'essentiel de la carte. */}
      <div className="house-num">M{idx + 1}</div>
      <MiniFigure fig={fig} size={size} />
      <div className="fig-name">{getCleanName(figToKey(fig), fbData)}</div>
      <div className="bzdh-value">Ordre {getBZDHValue(fig)}</div>
    </div>
  );
}

function ModalBlock({ tone, title, domaine, interpretation, prefix }: { tone: 'blue' | 'gold'; title: string; domaine: string; interpretation: string; prefix: string }) {
  return (
    <div className={'modal-block ' + tone}>
      <h4 style={{ color: tone === 'blue' ? '#4facfe' : 'var(--gold)' }}>{title}</h4>
      <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--gold)' }}>
        <strong>Domaine :</strong> {domaine}
      </p>
      <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>
        {prefix} {interpretation}
      </p>
    </div>
  );
}

function HouseModal({ data, onClose }: { data: any; onClose: () => void }) {
  const stop = (e: React.MouseEvent) => e.target === e.currentTarget && onClose();
  return (
    <div className="geo-modal-overlay" onClick={stop}>
      <div className="geo-modal">
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
        <h3>
          Maison {data.houseIndex + 1} – {data.houseName}
        </h3>
        <p style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: 6 }}>
          <strong>Occupante :</strong> {data.title} | <span style={{ color: '#4facfe' }}>بزدح: {data.bzdh}</span>
        </p>

        {data.kind === 'judge' && (
          <>
            <div className="copulation-steps">
              <div className="step-fig" style={{ border: '2px solid var(--gold)' }}>
                <strong>Verdict</strong>
                <br />
                <MiniFigure fig={data.houseFig} />
                <small style={{ color: 'var(--gold)', fontWeight: 700 }}>{data.cleanName}</small>
              </div>
            </div>
            <ModalBlock
              tone="gold"
              title="Interprétation du Juge"
              domaine={data.data ? data.data.domaine : 'Le verdict final.'}
              interpretation={data.data ? data.data.interpretation : 'Données en cours de chargement...'}
              prefix="👉"
            />
          </>
        )}

        {data.kind === 'sentence' && (
          <>
            <div className="copulation-steps">
              <div className="step-fig">
                <strong>Juge</strong>
                <br />
                <MiniFigure fig={data.judgeFig} />
              </div>
              <span style={{ fontSize: '1.3rem', color: 'var(--gold)' }}>+</span>
              <div className="step-fig">
                <strong>M1 (Âme)</strong>
                <br />
                <MiniFigure fig={data.m1Fig} />
                <small>{data.m1Name}</small>
              </div>
              <span style={{ fontSize: '1.3rem', color: 'var(--gold)' }}>=</span>
              <div className="step-fig" style={{ border: '2px solid var(--gold)' }}>
                <strong>Sentence</strong>
                <br />
                <MiniFigure fig={data.houseFig} />
                <small style={{ color: 'var(--gold)', fontWeight: 700 }}>{data.cleanName}</small>
              </div>
            </div>
            <ModalBlock
              tone="gold"
              title="Interprétation de la Sentence"
              domaine={data.data ? data.data.domaine : 'Le point de chute final.'}
              interpretation={data.data ? data.data.interpretation : 'Données en cours de chargement...'}
              prefix="👉"
            />
          </>
        )}

        {data.kind === 'normal' && (
          <>
            <ModalBlock
              tone="blue"
              title={`Étape 1 : ${data.step1Data ? data.step1Data.titre : data.step1Title}`}
              domaine={data.step1Data ? data.step1Data.domaine : 'Parole de la Maison (Occupante + Repos)'}
              interpretation={data.step1Data ? data.step1Data.interpretation : 'En attente des données Firebase...'}
              prefix="👉 Interprétation :"
            />
            <ModalBlock
              tone="gold"
              title={`Secret Final : ${data.step2Data ? data.step2Data.titre : data.step2Title}`}
              domaine={data.step2Data ? data.step2Data.domaine : 'Décret du Juge (Parole + Juge)'}
              interpretation={data.step2Data ? data.step2Data.interpretation : 'En attente des données Firebase...'}
              prefix="✨ Interprétation :"
            />
          </>
        )}
      </div>
    </div>
  );
}
