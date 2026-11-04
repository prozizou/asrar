'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { BANNERS, BANNERS_ENABLED, Banner } from './AdsterraBanner';
import { AD_WAIT_MS, sampleAdTab } from '@/lib/actionAd';
export { AD_WAIT_MS };

// Only foreground time with a loaded, visible ad counts. A popup or a timer
// alone never unlocks an action. Cross-origin content cannot be inspected.
export default function AdCountdown({ onDone, onRemoveAds }) {
  const [state, setState] = useState(BANNERS_ENABLED ? 'loading' : 'error');
  const [elapsed, setElapsed] = useState(0), [attempt, setAttempt] = useState(0);
  const area = useRef(null);
  const updateState = useCallback((value) => { setState(value); if (value !== 'ready') setElapsed(0); }, []);
  useEffect(() => {
    let last = Date.now();
    let visible = false;
    const frame = Array.from(area.current?.querySelectorAll('iframe') || []).find((node) => {
      const rect = node.getBoundingClientRect(); return rect.width >= 150 && rect.height >= 125;
    });
    const observer = frame && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio >= .5; }, { threshold: [0, .5, 1] }) : null;
    if (frame) observer?.observe(frame);
    const tick = () => {
      const now = Date.now(), delta = Math.min(250, Math.max(0, now - last)); last = now;
      sampleAdTab();
      if (state !== 'ready' || document.visibilityState !== 'visible' || !frame?.isConnected || !visible) return;
      const rect = frame.getBoundingClientRect(), style = getComputedStyle(frame);
      if (rect.width < 150 || rect.height < 125 || style.visibility === 'hidden' || Number(style.opacity) === 0) return;
      for (let node = frame.parentElement; node; node = node.parentElement) {
        const parentStyle = getComputedStyle(node);
        if (parentStyle.visibility === 'hidden' || Number(parentStyle.opacity) === 0) return;
      }
      const visiblePixels = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0)) * Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
      if (visiblePixels / (rect.width * rect.height) < .5) return;
      setElapsed((value) => Math.min(AD_WAIT_MS, value + delta));
    };
    const timer = setInterval(tick, 250);
    const resetClock = () => { last = Date.now(); };
    document.addEventListener('visibilitychange', resetClock);
    return () => { observer?.disconnect(); clearInterval(timer); document.removeEventListener('visibilitychange', resetClock); };
  }, [state]);
  const left = Math.ceil((AD_WAIT_MS - elapsed) / 1000);
  return <Modal className="sg-overlay" label="Publicité" onClose={() => onDone(false)}>
    <div className="sg-box">
      <h2>Une publicité pour cette action</h2>
      <p className="sg-sub">L’action reste en attente jusqu’à l’affichage de la publicité.</p>
      {BANNERS_ENABLED && <div ref={area} className="action-ad-area"><Banner key={attempt} banner={BANNERS.b300x250} onStateChange={updateState} /></div>}
      <p role="status" aria-live="polite" className="sg-sub">
        {state === 'loading' ? 'Chargement de la publicité…' : state === 'error' ? 'Aucune publicité disponible. Patientez puis réessayez, ou choisissez un abonnement sans publicités.' : left > 0 ? `Gardez la publicité visible pendant encore ${left} s.` : 'Publicité affichée. Vous pouvez continuer.'}
      </p>
      {state === 'ready' && left === 0 && <button type="button" className="sg-card best" onClick={() => onDone(true)}>Continuer</button>}
      {state === 'error' && <button type="button" className="sg-card" onClick={() => { setElapsed(0); setState(BANNERS_ENABLED ? 'loading' : 'error'); setAttempt((value) => value + 1); }}>Réessayer la publicité</button>}
      <button type="button" className="sg-card" onClick={onRemoveAds}>Choisir un abonnement sans publicités</button>
      <button type="button" className="sg-card" onClick={() => onDone(false)}>Annuler l’action</button>
    </div>
  </Modal>;
}
