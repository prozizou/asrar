'use client';
// Module « Formation mystique » — ateliers/formations en direct, chacun avec
// un lien de visioconférence Google Meet. LIEN SIMPLE (choix de l'utilisateur
// lors de la mise en place) : l'admin colle un lien meet.google.com/... créé
// à la main pour chaque session, PAS d'intégration Google Calendar API (pas
// de compte de service Google Cloud à provisionner, mise en place immédiate).
//
// Titre/description/durée/prix/attentes : aperçu toujours libre (comme la
// Bibliothèque) via /api/list-content. Seul le lien Meet est un champ payant
// (server/sources.js "formation", secretFields: ["meetLink"]) — révélé
// uniquement par /api/get-content, gaté par ensureAccess() (abonnement actif
// requis), au moment de cliquer « Rejoindre ». Même mécanisme que la
// Bibliothèque (pdf/pdfUrl) ou Secret Mystique (sirr).
import './formation.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { useAccess } from '@/components/AccessProvider';
import { formatPrice } from '@/lib/market';
import { optimImg } from '@/lib/img';
import SmartImageUntyped from '@/components/SmartImage';
import { useHistoryClose } from '@/components/useHistoryClose';

const SmartImage = SmartImageUntyped as any;

// Repli si l'admin n'a pas (encore) renseigné de lien pour une formation :
// ouvre un nouveau Google Meet à la volée plutôt que de bloquer le clic.
const MEET_FALLBACK = 'https://meet.google.com/new';

interface Formation {
  _key: string;
  titre: string;
  description?: string;
  attentes?: string;
  duree?: string;
  prix?: number;
  img?: string;
  updatedAt?: number;
  [k: string]: any;
}

export default function FormationPage() {
  // useAccess() vient d'AccessProvider.js : son contexte est créé via
  // createContext(null), donc TS l'infère `null` sans cast — la vraie forme
  // documentée ici en local (même principe que dans les autres modules).
  const { ensureAccess, openGate } = useAccess() as unknown as {
    ensureAccess: (minLevel?: number) => Promise<boolean>;
    openGate: (reason?: string | null) => void;
  };
  const [items, setItems] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<Formation | null>(null);
  const [joining, setJoining] = useState(false);
  const bootRef = useRef(false);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    (async () => {
      try {
        const { items } = await apiPost('list-content', { kind: 'formation' });
        const list: Formation[] = (items || []).slice().sort(
          (a: Formation, b: Formation) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)
        );
        setItems(list);
      } catch (e: any) {
        setError(e.message || 'Erreur de chargement.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const inDetail = !!current;
  const closeDetail = useCallback(() => setCurrent(null), []);
  // Backpress Android : ferme le détail (pas de vraie navigation de page ici).
  const goBackFromDetail = useHistoryClose(inDetail, closeDetail);

  const joinMeet = async () => {
    if (!current || joining) return;
    const ok = await ensureAccess();
    if (!ok) return;
    setJoining(true);
    try {
      const { item } = await apiPost('get-content', { kind: 'formation', key: current._key });
      const link = (item && item.meetLink) || MEET_FALLBACK;
      const w = window.open(link, '_blank', 'noopener');
      if (!w) window.location.href = link;
    } catch (e: any) {
      if (e.status === 403) openGate(); // paywall serveur : accès perdu entre-temps
      else alert('Erreur : ' + e.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="container">
      {inDetail ? (
        <>
          <button type="button" className="back-btn fm-back-btn" onClick={goBackFromDetail}>
            ← Retour
          </button>
          <div className="glass-panel fm-detail">
            {current!.img && (
              <div className="fm-detail-cover">
                <SmartImage
                  src={optimImg(current!.img, 700)}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 600px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            )}
            <h2>{current!.titre}</h2>
            {(current!.duree || Number(current!.prix) > 0) && (
              <div className="fm-detail-meta">
                {current!.duree && <span>⏱️ {current!.duree}</span>}
                {Number(current!.prix) > 0 && <span>💳 {formatPrice(current!.prix, 'FCFA')}</span>}
              </div>
            )}
            {current!.description && <p className="fm-detail-text">{current!.description}</p>}
            {current!.attentes && (
              <>
                <h3>Ce que ça vous apporte</h3>
                <p className="fm-detail-text">{current!.attentes}</p>
              </>
            )}
            <button type="button" className="fm-join-btn" onClick={joinMeet} disabled={joining}>
              {joining ? 'Ouverture…' : '🎥 Rejoindre la visioconférence'}
            </button>
          </div>
        </>
      ) : (
        <>
          <Link href="/menu" className="back-btn">
            ← Retour
          </Link>
          <div className="glass-panel">
            <h2>🎓 Formation mystique</h2>
            <p className="fm-subtitle">Ateliers et formations en direct, par visioconférence.</p>
          </div>
          <div className="fm-grid">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="fm-skeleton" />)
            ) : error ? (
              <p className="fm-empty">
                Erreur de chargement.
                <br />
                <small>{error}</small>
              </p>
            ) : items.length === 0 ? (
              <p className="fm-empty">Aucune formation programmée pour l’instant.</p>
            ) : (
              items.map((f) => (
                <div key={f._key} className="fm-card" onClick={() => setCurrent(f)}>
                  <div className="fm-cover">
                    {f.img ? (
                      <SmartImage
                        src={optimImg(f.img, 400)}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 45vw, 260px"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      '🎓'
                    )}
                  </div>
                  <div className="fm-body">
                    <div className="fm-title">{f.titre}</div>
                    <div className="fm-meta">
                      {f.duree && <span>⏱️ {f.duree}</span>}
                      {Number(f.prix) > 0 && <span>💳 {formatPrice(f.prix, 'FCFA')}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
