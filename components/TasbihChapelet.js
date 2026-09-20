'use client';
// Compteur de dhikr (UI) — chapelet complet, utilisé par le « Zikr collectif »
// (app/zikr). Pur affichage : toute la logique métier vit dans useTasbih
// (components/useTasbih.js).
//
// Port du chapelet du ZIP de référence (« mon-chapelet »), qui remplace l'arc
// à 9 grains précédent. Le fil est UN SEUL chemin SVG fermé : il monte à
// gauche, passe par l'arc du haut, redescend à droite, puis boucle par le bas
// (hors champ). Les grains ne sont pas posés « à côté » d'une ligne : leur
// position est lue directement sur le tracé (getPointAtLength), donc ils le
// suivent exactement, y compris dans la courbe de l'arc, et transitent
// réellement par l'arc pour passer d'un brin à l'autre.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { objSubdivisions } from '@/lib/objSubdivisions';

// Un vrai chapelet complet : 100 grains sur la boucle, visibles ou non. C'est
// aussi la période du défilement — il faut 100 taps pour revenir au point de
// départ, au lieu de boucler au bout de quelques dizaines (ce qui donnait
// l'impression que le compteur se réinitialisait).
const BEAD_COUNT = 100;

// Géométrie du fil (voir geometryFor) — gabarit nettement plus grand qu'un
// arc classique (revue design : « le chapelet ne donne pas la sensation d'un
// véritable objet interactif, la zone principale devrait lui être
// consacrée »). Le fil continue de descendre très bas hors champ (BOT_L/
// BOT_R) pour porter les 100 grains à un espacement naturel.
function geometryFor() {
  const VIEW_W = 192;
  const VIEW_H = 234;
  const BEAD_D = 20;
  const RX = 52;    // demi-écart entre les deux brins
  const RY = 34;    // hauteur de l'arc
  const TOP_Y = 44; // hauteur à laquelle les brins rejoignent l'arc
  // Volontairement asymétriques (le brin droit descend plus bas).
  //
  // ⚠️ Ces deux valeurs FIXENT L'ESPACEMENT DES GRAINS, pas seulement la
  // réserve hors champ : les 100 grains sont répartis sur TOUTE la boucle,
  // donc espacement = longueur_totale / 100. Mettre BOT_L/BOT_R à l'échelle
  // avec VIEW_W/VIEW_H (ce qu'avait fait un agrandissement précédent de ce
  // gabarit) doublait l'écart entre grains — 31 px de vide pour un grain de
  // 20 px, « plus du tout naturel » pour un chapelet. Le fil reste donc PLUS
  // COURT que la mise à l'échelle proportionnelle : 2354 px / 100 grains =
  // 23,5 d'espacement pour un grain de 20 (vide 3,5), soit des grains quasi
  // jointifs, enfilés, comme sur un vrai tasbih. Mesurable à tout moment avec
  // getTotalLength() sur le tracé.
  const BOT_R = 1100;
  const BOT_L = 1040;
  const CX = VIEW_W / 2;
  // Le fil complet, dans l'ordre du parcours : arc du haut (gauche → droite),
  // brin droit vers le bas, boucle du bas (hors champ), puis `Z` referme en
  // remontant le brin gauche. Avancer le long de ce chemin fait donc monter
  // les grains à gauche et descendre ceux de droite, comme une seule boucle.
  const LOOP_PATH =
    `M ${CX - RX} ${TOP_Y} ` +
    `A ${RX} ${RY} 0 0 1 ${CX + RX} ${TOP_Y} ` +
    `L ${CX + RX} ${BOT_R} ` +
    `Q ${CX} ${BOT_R + 80} ${CX - RX} ${BOT_L} Z`;
  return { VIEW_W, VIEW_H, BEAD_D, BEAD_R: BEAD_D / 2, LOOP_PATH };
}

const TAP_DURATION = 280;
const TAP_PULSE_MS = 180; // durée du pulse visuel sur le compteur au tap (voir handleTap)
// Le bas s'estompe : le fil continue hors champ au lieu d'être tranché net.
const FADE_MASK = 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)';

/**
 * @param {object} props
 * @param {string} props.id          identifiant de rendu (aria/DOM)
 * @param {object} props.t           résultat de useTasbih() — passer `uncapped`
 *   (3e argument) quand `collectifRestant` est fourni, cf. ci-dessous.
 * @param {number} [props.collectifRestant]  Zikr collectif : ce qu'il reste à
 *   faire au GROUPE entier (même nombre pour tous, mis à jour en direct).
 *   Remplace entièrement les réglages personnels (objectif, séries, remise à
 *   zéro, suggestions de répartition — aucun n'a de sens pour un objectif
 *   partagé et non modifiable) par un simple badge en lecture seule, et
 *   masque la barre de progression personnelle (sans objectif propre, elle
 *   n'a rien de pertinent à montrer).
 * @param {number} [props.myFait]  Zikr collectif : valeur CORRIGÉE de mes
 *   grains (max du compteur local et du dernier total connu du serveur —
 *   voir MemberCounter, app/zikr/page.tsx) à afficher à la place de `t.total`
 *   brut, qui peut brièvement retarder sur un second appareil. Absent hors du
 *   Zikr collectif : `t.total` fait alors foi.
 * @param {boolean} [props.embedded]  Zikr collectif : true quand ce
 *   composant est nesté dans une carte englobante qui porte déjà son propre
 *   fond/bordure/padding (.zk-zikr-card, app/zikr/page.tsx) — retire le
 *   cadre PROPRE au chapelet (`.tc`) pour éviter un double encadrement
 *   (revue design : « boîte dans la boîte »).
 */
export default function TasbihChapelet({ id, t, collectifRestant, myFait, embedded }) {
  const isCollectif = collectifRestant !== undefined;
  // Objectif du GROUPE atteint (collectifRestant retombé à 0) : le compteur
  // devient inactif — demandé explicitement. Continuer à taper au-delà de la
  // cible partagée n'a plus de sens (chaque grain compte pour le groupe
  // entier, pas une part personnelle) et laissait croire à tort qu'il restait
  // quelque chose à réciter. Ne s'applique qu'au Zikr collectif : un chapelet
  // hors Zikr collectif (`collectifRestant` omis) resterait `uncapped`.
  const collectifDone = isCollectif && collectifRestant <= 0;
  const { VIEW_W, VIEW_H, BEAD_D, BEAD_R, LOOP_PATH } = useMemo(() => geometryFor(), []);
  // Réglages (objectif/séries/suggestions/réinitialiser) repliés par défaut
  // (revue design, module Noms d'Allah) : affichés en permanence, ils
  // ajoutaient un rang de « pilules » avant même d'arriver au compteur, et
  // le bouton réinitialiser était à un tap accidentel du reste. Non pertinent
  // en Zikr collectif (branche isCollectif, aucun réglage personnel) — l'état
  // n'y est jamais lu.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Retour visuel immédiat au tap (revue design : « animation subtile du
  // grain ») — en plus de la vibration déjà déclenchée par t.tap()
  // (components/useTasbih.js) : un bref pulse sur le compteur, retiré après
  // TAP_PULSE_MS. setTimeout (pas juste une classe CSS avec transition à
  // l'aller uniquement) pour que deux taps rapprochés puissent chacun
  // relancer l'animation depuis zéro.
  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef(null);
  const pathRef = useRef(null);
  const beadRefs = useRef([]);
  const stageRef = useRef(null);
  const offsetRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef(0);
  const samplesRef = useRef(null);

  // Échantillonne le fil une bonne fois pour toutes (un point par pixel). Le
  // tracé ne changeant jamais, cela évite 100 getPointAtLength() par frame sur
  // un chemin de ~3100 px.
  const ensureSamples = useCallback(() => {
    if (samplesRef.current) return samplesRef.current;
    const path = pathRef.current;
    if (!path) return null;
    const total = path.getTotalLength();
    const count = Math.ceil(total) + 1;
    const xs = new Float32Array(count);
    const ys = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const point = path.getPointAtLength(i > total ? total : i);
      xs[i] = point.x;
      ys[i] = point.y;
    }
    samplesRef.current = { xs, ys, total };
    return samplesRef.current;
  }, []);

  // Repositionne chaque grain sur le fil, à `offset` + son rang. Les grains
  // hors de la fenêtre visible (la grande majorité) sont simplement masqués :
  // inutile de réécrire leur position à chaque frame.
  const layout = useCallback(
    (offset) => {
      const samples = ensureSamples();
      if (!samples) return;
      const { xs, ys, total } = samples;
      const spacing = total / BEAD_COUNT;

      for (let i = 0; i < BEAD_COUNT; i++) {
        const bead = beadRefs.current[i];
        if (!bead) continue;

        let len = (offset + i * spacing) % total;
        if (len < 0) len += total;

        const lower = Math.floor(len);
        const upper = lower + 1 < xs.length ? lower + 1 : lower;
        const frac = len - lower;
        const y = ys[lower] + (ys[upper] - ys[lower]) * frac;

        if (y < -BEAD_D || y > VIEW_H + BEAD_D) {
          if (bead.style.visibility !== 'hidden') bead.style.visibility = 'hidden';
          continue;
        }

        const x = xs[lower] + (xs[upper] - xs[lower]) * frac;
        if (bead.style.visibility) bead.style.visibility = '';
        bead.style.transform = `translate(${x - BEAD_R}px, ${y - BEAD_R}px)`;
      }
    },
    [ensureSamples, BEAD_D, BEAD_R, VIEW_H]
  );

  useEffect(() => {
    // Première mise en place : les grains restent transparents tant qu'ils
    // n'ont pas leur vraie position (sinon ils apparaîtraient tous empilés
    // dans le coin le temps d'une frame).
    layout(0);
    if (stageRef.current) stageRef.current.style.opacity = '1';
    const raf = rafRef;
    return () => cancelAnimationFrame(raf.current);
  }, [layout]);

  const handleTap = () => {
    if (collectifDone) return; // objectif du groupe atteint — plus rien à compter

    t.tap();

    setPulse(true);
    clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(false), TAP_PULSE_MS);

    const samples = ensureSamples();
    if (!samples) return;
    const { total } = samples;
    const spacing = total / BEAD_COUNT;

    // La cible avance d'un cran par tap DANS L'ABSOLU, indépendamment de
    // l'animation en cours : un tap qui en interrompt un autre reprend depuis
    // la position courante mais vise toujours le bon cran. Sans cela, tapoter
    // vite perdrait la fraction non parcourue à chaque interruption et le
    // chapelet se désynchroniserait du compteur.
    targetRef.current += spacing;
    const from = offsetRef.current;
    const to = targetRef.current;
    const startedAt = performance.now();

    cancelAnimationFrame(rafRef.current);
    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / TAP_DURATION);
      const eased = 1 - Math.pow(1 - progress, 3);
      offsetRef.current = from + (to - from) * eased;
      layout(offsetRef.current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      // Ramène les valeurs dans [0, total) une fois posé, pour qu'elles ne
      // grandissent pas indéfiniment au fil des milliers de taps.
      offsetRef.current = to % total;
      targetRef.current = offsetRef.current;
      layout(offsetRef.current);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const subs = objSubdivisions(t.target);

  // Active/désactive le tap au clavier (Entrée/Espace) — la zone tactile
  // (tc-tapzone, plus bas) est un vrai `role="button"` focusable, pas un
  // simple `onClick` sur un `<div>` (revue design : « accessibilité
  // clavier »). Espace empêche aussi le défilement de la page, comme pour
  // n'importe quel bouton natif.
  const onTapZoneKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTap();
    }
  };

  return (
    <div
      id={`tasbih-${id}`}
      className={'tc' + (collectifDone ? ' tc-inactive' : '') + (embedded ? ' tc-embedded' : '')}
    >
      {/* Réglages personnels (objectif/séries/suggestions/réinitialiser) —
          UNIQUEMENT hors Zikr collectif : en collectif, l'objectif partagé
          restant est déjà affiché par l'appelant (CollectiveProgress,
          app/zikr/page.tsx) et « Objectif atteint » par la carte trophée
          (.zk-reached-card) — le répéter ici une troisième fois n'apportait
          plus rien pendant la récitation (revue design : « informations
          secondaires qui occupent de la place sans être prioritaires »). */}
      {!isCollectif && (
        <div className="tc-settings">
          {/* Replié par défaut : objectif/séries/suggestions/réinitialiser
              sont des réglages, pas l'action principale — un bouton à
              libellé clair plutôt que ces contrôles ouverts en permanence
              (voir commentaire sur `settingsOpen` plus haut). */}
          <button
            type="button"
            className="tc-settings-toggle"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <span aria-hidden>⚙️</span> Réglages du compteur
            {t.seriesCount > 0 && (
              <span className="tc-loop">
                Série {t.loopCur}/{t.seriesCount}
              </span>
            )}
          </button>

          {settingsOpen && (
            <>
              <div className="tc-group" title="Objectif de récitation">
                <span aria-hidden>🎯</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Obj."
                  aria-label="Objectif"
                  value={t.target}
                  onChange={(e) => t.setTarget(e.target.value)}
                />
              </div>

              <div className="tc-group" title="Nombre de séries — l'objectif est réparti dessus, le reste va sur la dernière">
                <span aria-hidden>🔁</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Séries"
                  aria-label="Nombre de séries"
                  value={t.series}
                  onChange={(e) => t.setSeries(e.target.value)}
                />
              </div>

              {subs.length > 0 && (
                // Menu déroulant plutôt qu'une rangée de puces : objSubdivisions()
                // peut renvoyer jusqu'à 40 suggestions (objectifs très divisibles,
                // ex. 100000), ce qui débordait sur plusieurs lignes en <select>
                // compact, un seul contrôle quel que soit le nombre de suggestions.
                <div className="tc-group tc-subdiv" title="Suggestions de répartition (base × séries)">
                  <span aria-hidden>🔀</span>
                  <select
                    aria-label="Suggestions de répartition"
                    value={subs.some((sub) => sub.series === t.seriesCount) ? String(t.seriesCount) : ''}
                    onChange={(e) => { if (e.target.value) t.setSeries(e.target.value); }}
                  >
                    <option value="">Suggestions…</option>
                    {subs.map((sub) => (
                      <option key={sub.label} value={sub.series}>{sub.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Réinitialiser DANS le panneau replié plutôt qu'en accès
                  direct (revue design) : un tap accidentel sur un bouton
                  toujours visible pouvait effacer une série en cours. */}
              <button type="button" className="tc-reset" aria-label="Réinitialiser le compteur" onClick={t.reset}>
                <span aria-hidden>↺</span> Réinitialiser
              </button>
            </>
          )}
        </div>
      )}

      {/* Zone tactile UNIQUE (revue design : « toute la zone du chapelet
          pourrait être cliquable ») — role="button" focusable au clavier
          (Entrée/Espace), plutôt qu'un simple onClick sur un <div> englobant
          aussi les réglages ci-dessus (qui, eux, ne doivent jamais compter
          comme un tap — les séparer en évite le risque au lieu de reposer
          sur un stopPropagation). */}
      <div
        className="tc-tapzone"
        role="button"
        tabIndex={collectifDone ? -1 : 0}
        aria-disabled={collectifDone}
        aria-label={collectifDone ? 'Objectif du groupe atteint — compteur inactif' : 'Toucher pour égrener un grain'}
        onClick={handleTap}
        onKeyDown={onTapZoneKeyDown}
      >
        {isCollectif && collectifDone && (
          <div className="tc-group-done" title="Objectif du Zikr collectif atteint">
            <span aria-hidden>🎉</span> Objectif atteint
          </div>
        )}

        {/* Compteur = progression CUMULÉE vers l'objectif (t.total), pas le
            compte de la série en cours (t.count, qui repart à 0 à chaque
            série et affichait donc « 00 » de façon ambiguë juste à côté d'une
            ligne « Progression 0/2086 » redondante — revue design). En Zikr
            collectif (uncapped=true dans useTasbih), t.total === t.count : ce
            changement n'affecte donc pas son affichage — SAUF que `myFait`
            (corrigé, voir MemberCounter) remplace `t.total` brut quand fourni,
            pour rester exact sur un second appareil. ÉLÉMENT DOMINANT de
            l'écran en Zikr collectif (revue design : « le compteur personnel
            doit devenir l'élément dominant ») — voir .tc-embedded .tc-counter,
            app/globals.css. Pulse bref au tap (retour visuel immédiat, en
            plus de la vibration déjà déclenchée par t.tap()). */}
        {isCollectif && <div className="tc-counter-label">Vos récitations</div>}
        <div className={'tc-counter' + (pulse ? ' tc-counter-pulse' : '')} aria-live="polite" aria-atomic="true">
          {isCollectif && myFait !== undefined ? myFait : t.total}
        </div>
        {!isCollectif && <div className="tc-counter-target">sur {t.numericTarget || '—'}</div>}

        {/* Série de jours (portée globale, tous dhikr confondus) */}
        {t.streak > 0 && (
          <div className="tc-streak" aria-live="polite">
            <span>
              🔥 Série : {t.streak} jour{t.streak > 1 ? 's' : ''}
            </span>
            {t.newBadge && (
              <span className="tc-badge">
                {t.newBadge.icon} Badge « {t.newBadge.label} » débloqué !
              </span>
            )}
          </div>
        )}

        {/* Barre de progression seule — le texte « Progression N/cible » a été
            retiré : redondant avec le compteur ci-dessus, qui affiche
            désormais directement cette même valeur. Sans objectif propre en
            Zikr collectif (celui du groupe est déjà affiché par l'appelant),
            rien de pertinent à montrer ici. */}
        {!isCollectif && (
          <div className="tc-progress">
            <div className="tc-bar" role="progressbar" aria-valuenow={t.total} aria-valuemin={0} aria-valuemax={t.numericTarget || 0}>
              <span style={{ width: t.pct + '%' }} />
            </div>
          </div>
        )}

        {/* Le chapelet : le fil (SVG) puis les grains posés dessus. */}
        <div
          aria-hidden
          className="tc-stage-wrap"
          style={{
            width: VIEW_W,
            height: VIEW_H,
            WebkitMaskImage: FADE_MASK,
            maskImage: FADE_MASK,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          }}
        >
          <svg width={VIEW_W} height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="tc-thread">
            <path ref={pathRef} d={LOOP_PATH} fill="none" stroke="rgba(165,120,60,0.55)" strokeWidth={2} />
          </svg>

          <div ref={stageRef} className="tc-stage">
            {Array.from({ length: BEAD_COUNT }).map((_, i) => (
              <div
                key={i}
                ref={(el) => {
                  beadRefs.current[i] = el;
                }}
                className="tc-bead"
                style={{ width: BEAD_D, height: BEAD_D }}
              />
            ))}
          </div>
        </div>

        {!collectifDone && <p className="tc-hint">Touchez pour égrainer</p>}
      </div>
    </div>
  );
}
