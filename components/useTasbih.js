'use client';
// Compteur de dhikr par nom — port de tasbihLogic.js (handleTasbihAction,
// updateProgress, resetTasbih, updateTasbihSettings) en hook React. Toute la
// persistance reste en localStorage, avec les mêmes clés que le site statique
// (tasbih_asma_/target_/loopmax_/loopcur_) → compteurs partagés entre les deux.
import { useCallback, useMemo, useRef, useState } from 'react';
import { playBeadSound, playGoalSound } from '@/lib/audio';
import { getStreak, recordCompletion } from '@/lib/dhikrStreak';

const ls = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

const vibrate = (pattern) => {
  try {
    if (window.navigator.vibrate) window.navigator.vibrate(pattern);
  } catch {}
};

export function useTasbih(id, autoTarget) {
  const initialTarget = (() => {
    const t = ls.get(`tasbih_target_${id}`);
    return t === null || t === '' ? String(autoTarget || '') : t;
  })();

  const [count, setCount] = useState(() => parseInt(ls.get(`tasbih_asma_${id}`)) || 0);
  const [target, setTargetState] = useState(initialTarget);
  const [series, setSeriesState] = useState(() => ls.get(`tasbih_loopmax_${id}`) || '');
  const [loopCur, setLoopCur] = useState(() => parseInt(ls.get(`tasbih_loopcur_${id}`)) || 0);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef(null);
  // Série de jours de dhikr (lib/dhikrStreak.js) — portée GLOBALE (tous
  // noms confondus), pas propre à `id` : chaque instance de useTasbih lit/
  // écrit donc le même état partagé, volontairement.
  const [streak, setStreak] = useState(() => getStreak().current);
  const [newBadge, setNewBadge] = useState(null);
  const badgeTimer = useRef(null);

  const grand = parseInt(target) || 0;
  const seriesCount = parseInt(series) || 0;
  const numericTarget = grand || parseInt(autoTarget) || 0;
  const base = seriesCount > 0 ? Math.floor(grand / seriesCount) : 0;

  // Progression cumulée : (base × séries terminées) + série en cours, plafonnée.
  const total = useMemo(() => {
    let t = base * loopCur + count;
    if (grand > 0 && t > grand) t = grand;
    return t;
  }, [base, loopCur, count, grand]);
  const pct = grand > 0 ? Math.min(100, (total / grand) * 100) : 0;

  const tap = useCallback(() => {
    let c = count + 1;
    const remainder = seriesCount > 0 ? grand - base * seriesCount : 0;
    let loops = loopCur;
    const isLast = loops === seriesCount - 1;
    const threshold = isLast ? base + remainder : base;
    let goalDone = false;

    if (seriesCount > 0) {
      if (c === threshold) {
        loops++;
        setLoopCur(loops);
        ls.set(`tasbih_loopcur_${id}`, loops);
        if (loops >= seriesCount) {
          goalDone = true;
        } else {
          c = 0;
          playGoalSound();
          vibrate([60, 40, 120]);
        }
      }
    } else if (grand > 0 && c === grand) {
      goalDone = true;
    }

    if (goalDone) {
      playGoalSound();
      vibrate([100, 50, 100, 50, 200]);
      setFlash(true);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), 1000);

      // Série de dhikr : un seul décompte par jour, quel que soit le nombre
      // d'objectifs terminés (recordCompletion() renvoie null si déjà compté
      // aujourd'hui — cf. lib/dhikrStreak.js).
      const badge = recordCompletion();
      setStreak(getStreak().current);
      if (badge) {
        setNewBadge(badge);
        clearTimeout(badgeTimer.current);
        badgeTimer.current = setTimeout(() => setNewBadge(null), 3200);
      }
    } else if (c !== 0) {
      vibrate([18, 12, 24]);
      playBeadSound();
    }

    setCount(c);
    ls.set(`tasbih_asma_${id}`, c);
  }, [count, seriesCount, grand, base, loopCur, id]);

  const setTarget = useCallback(
    (v) => {
      setTargetState(v);
      ls.set(`tasbih_target_${id}`, v);
    },
    [id]
  );

  const setSeries = useCallback(
    (v) => {
      setSeriesState(v);
      ls.set(`tasbih_loopmax_${id}`, v);
      if (!(v && parseInt(v) > 0)) {
        setLoopCur(0);
        ls.set(`tasbih_loopcur_${id}`, 0);
      }
    },
    [id]
  );

  const reset = useCallback(() => {
    setCount(0);
    setLoopCur(0);
    ls.set(`tasbih_asma_${id}`, 0);
    ls.set(`tasbih_loopcur_${id}`, 0);
  }, [id]);

  return {
    count, target, series, loopCur, seriesCount, numericTarget, total, pct, flash,
    streak, newBadge, tap, setTarget, setSeries, reset,
  };
}
