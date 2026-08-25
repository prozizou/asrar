'use client';
// Compteur de dhikr (UI) — chapelet complet, partagé par « Noms d'Allah »
// (app/benefits) et le « Zikr collectif » (app/zikr). Pur affichage : toute la
// logique métier vit dans useTasbih (components/useTasbih.js).
//
// Port du chapelet du ZIP de référence (« mon-chapelet »), qui remplace l'arc
// à 9 grains précédent. Le fil est UN SEUL chemin SVG fermé : il monte à
// gauche, passe par l'arc du haut, redescend à droite, puis boucle par le bas
// (hors champ). Les grains ne sont pas posés « à côté » d'une ligne : leur
// position est lue directement sur le tracé (getPointAtLength), donc ils le
// suivent exactement, y compris dans la courbe de l'arc, et transitent
// réellement par l'arc pour passer d'un brin à l'autre.
import { useCallback, useEffect, useRef } from 'react';
import { objSubdivisions } from '@/lib/objSubdivisions';

// Un vrai chapelet complet : 100 grains sur la boucle, visibles ou non. C'est
// aussi la période du défilement — il faut 100 taps pour revenir au point de
// départ, au lieu de boucler au bout de quelques dizaines (ce qui donnait
// l'impression que le compteur se réinitialisait).
const BEAD_COUNT = 100;
const BEAD_D = 22;
const BEAD_R = BEAD_D / 2;

// Fenêtre visible. Le fil, lui, descend bien plus bas (BOT_L/BOT_R) et se
// referme hors champ : c'est cette réserve de grains masquée qui alimente le
// défilement sans jamais laisser de trou.
const VIEW_W = 160;
const VIEW_H = 250;

const CX = VIEW_W / 2;
const RX = 46;    // demi-écart entre les deux brins
const RY = 34;    // hauteur de l'arc
const TOP_Y = 46; // hauteur à laquelle les brins rejoignent l'arc
// Les brins descendent très bas hors champ : le fil est ainsi assez long pour
// porter les 100 grains à un espacement naturel, en gardant la même géométrie
// visible. Volontairement asymétriques (le brin droit descend plus bas).
const BOT_R = 1480;
const BOT_L = 1440;

// Le fil complet, dans l'ordre du parcours : arc du haut (gauche → droite),
// brin droit vers le bas, boucle du bas (hors champ), puis `Z` referme en
// remontant le brin gauche. Avancer le long de ce chemin fait donc monter les
// grains à gauche et descendre ceux de droite, comme une seule boucle.
const LOOP_PATH =
  `M ${CX - RX} ${TOP_Y} ` +
  `A ${RX} ${RY} 0 0 1 ${CX + RX} ${TOP_Y} ` +
  `L ${CX + RX} ${BOT_R} ` +
  `Q ${CX} ${BOT_R + 80} ${CX - RX} ${BOT_L} Z`;

const TAP_DURATION = 280;
// Le bas s'estompe : le fil continue hors champ au lieu d'être tranché net.
const FADE_MASK = 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)';

/**
 * @param {object} props
 * @param {string} props.id          identifiant de rendu (aria/DOM)
 * @param {object} props.t           résultat de useTasbih()
 * @param {boolean} [props.targetLocked]  masque le champ « Objectif » quand il
 *   est imposé par le contexte (Zikr collectif : l'objectif EST la part).
 */
export default function TasbihChapelet({ id, t, targetLocked = false }) {
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
    [ensureSamples]
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
    t.tap();

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

  return (
    <div
      id={`tasbih-${id}`}
      role="region"
      aria-label="Compteur de dhikr"
      className="tc"
      onClick={handleTap}
    >
      {/* Réglages : objectif, subdivisions suggérées, séries, remise à zéro.
          stopPropagation empêche ces interactions de compter comme un tap. */}
      <div className="tc-settings" onClick={(e) => e.stopPropagation()}>
        {!targetLocked && (
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
        )}

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

        {t.seriesCount > 0 && (
          <span className="tc-loop">
            Série {t.loopCur}/{t.seriesCount}
          </span>
        )}

        <button type="button" className="tc-reset" aria-label="Réinitialiser le compteur" onClick={t.reset}>
          ↺
        </button>

        {subs.length > 0 && (
          <div className="tc-subdiv">
            {subs.map((sub) => (
              <button
                key={sub.label}
                type="button"
                title={`Égrainer ${sub.base} fois, en ${sub.series} séries`}
                className={'tc-chip' + (t.seriesCount === sub.series ? ' active' : '')}
                onClick={() => t.setSeries(String(sub.series))}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tc-counter" aria-live="polite" aria-atomic="true">
        {String(t.count).padStart(2, '0')}
      </div>

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

      <div className="tc-progress">
        <div className="tc-progress-row">
          <span>Progression</span>
          <span>
            <strong>{t.total}</strong> / {t.numericTarget || 0}
          </span>
        </div>
        <div className="tc-bar">
          <span style={{ width: t.pct + '%' }} />
        </div>
      </div>

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

      <p className="tc-hint">Appuyez pour égrainer</p>
    </div>
  );
}
