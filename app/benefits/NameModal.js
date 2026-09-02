'use client';
// Modale d'un nom — port de showModal()/hideModal(). Verrouillée sans
// abonnement (nom seul + invitation), complète sinon (sens, bienfait, audio,
// favori). Fermeture par backdrop, croix ou Échap.
import { useEffect } from 'react';
import { implore } from '@/lib/benefits';
import { playAudio } from '@/lib/audio';

export default function NameModal({ item, accessGranted, isFav, onClose, onToggleFav, onOpenGate }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const numberBadge =
    item.number && item.number < 999 ? (
      <span className="stat-pill">
        <i className="fas fa-hashtag" />
        <span>{item.number}</span> sur 99
      </span>
    ) : null;

  return (
    <div className="modal" onClick={(e) => e.target.classList.contains('modal-backdrop') && onClose()}>
      <div className="modal-backdrop" />
      <div className="modal-dialog">
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="modal-body">
          {/* Le Nom lui-même (item.name, ex. « الرَّحْمَٰنُ ») en titre — pas la
              formule d'imploration (implore(), « يا رحمن ») : même correction que
              NameCard.js (revue design, point 6), pour ne pas brouiller la
              relation entre le Nom et la formule à réciter. */}
          <div className="modal-arabic">{item.name}</div>
          <div className="modal-translit">{item.translit}</div>
          {accessGranted && (
            <div className="modal-dhikr-formula" title="Formule du dhikr">
              <i className="fas fa-hands-praying" /> {implore(item.name)}
            </div>
          )}
          <div className="modal-number-badge">{numberBadge}</div>

          {accessGranted ? (
            <>
              <div className="modal-section">
                <div className="modal-section-label">
                  <i className="fas fa-gem" /> Signification
                </div>
                <div className="modal-text">{item.meaning}</div>
              </div>
              {item.benefit && (
                <div className="modal-section">
                  <div className="modal-section-label">
                    <i className="fas fa-leaf" /> Bienfait
                  </div>
                  <div className="modal-text">{item.benefit}</div>
                </div>
              )}
            </>
          ) : (
            <div className="modal-section" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', margin: '.4rem 0' }}>
                <i className="fas fa-lock" />
              </div>
              <div className="modal-text" style={{ marginBottom: '1rem' }}>
                Le sens, le secret et les carrés magiques de ce nom sont réservés aux abonnés.
              </div>
              <button className="btn btn-primary" onClick={onOpenGate}>
                <i className="fas fa-unlock" /> S'abonner pour débloquer
              </button>
            </div>
          )}
        </div>
        {accessGranted && (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => playAudio(item)}>
              <i className="fas fa-volume-up" /> Écouter
            </button>
            <button className={'btn btn-primary' + (isFav ? ' is-fav' : '')} onClick={() => onToggleFav(item.id)}>
              <i className={(isFav ? 'fas' : 'far') + ' fa-star'} /> {isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
