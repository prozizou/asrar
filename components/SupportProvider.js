'use client';
// Fenêtre « Soutenir ASRAR PRO » (contribution volontaire : Wave à montant
// libre, PI-SPI, WhatsApp). Deux façons de l'ouvrir :
//   • celebrate() — appelé par un module APRÈS une action réussie (export,
//     texte généré, calcul, objectif atteint). N'ouvre la fenêtre que si la
//     règle de lib/supportPrompt.js l'autorise (au plus une fois par jour,
//     pause après « Plus tard » / « J'ai déjà contribué », pour tous les
//     comptes) et seulement si aucune autre fenêtre n'est ouverte ;
//   • openSupport() — entrée « Soutenir l'application » (menu, Mon compte),
//     toujours disponible.
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, HandHeart, Landmark, LockKeyhole, MessageCircle, Wallet, X } from 'lucide-react';
import Modal from './Modal';
import { PISPI_ALIAS, supportWaveUrl } from '@/lib/subscriptionPayments';
import { reserveExternalWindow } from '@/lib/externalWindow';
import { openSupport as openSupportWhatsApp } from '@/lib/whatsapp';
import { STORAGE_KEY, parseState, shouldPrompt, afterShown, afterAnswer } from '@/lib/supportPrompt';

const SupportCtx = createContext({ celebrate: () => {}, openSupport: () => {} });
export const useSupport = () => useContext(SupportCtx);

// Laisse à l'utilisateur le temps de voir son résultat avant la fenêtre.
const CELEBRATE_DELAY_MS = 1200;

const readState = () => {
  try { return parseState(localStorage.getItem(STORAGE_KEY)); } catch { return parseState(null); }
};
const writeState = (state) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
};

export default function SupportProvider({ children }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const celebrate = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const now = Date.now();
      if (!shouldPrompt({ now, state: readState() })) return;
      if (document.querySelector('dialog[open]')) return; // une autre fenêtre est déjà ouverte
      writeState(afterShown(readState(), now));
      setOpen(true);
    }, CELEBRATE_DELAY_MS);
  }, []);

  const openSupport = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(true);
  }, []);

  const answer = useCallback((kind) => {
    writeState(afterAnswer(readState(), kind, Date.now()));
    setOpen(false);
  }, []);

  return (
    <SupportCtx.Provider value={{ celebrate, openSupport }}>
      {children}
      {open && <SupportDialog onAnswer={answer} />}
    </SupportCtx.Provider>
  );
}

function SupportDialog({ onAnswer }) {
  const id = useId();
  const [method, setMethod] = useState('wave');
  const [paidVia, setPaidVia] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const aliasInput = useRef(null);

  const openWave = async () => {
    setError('');
    const destination = reserveExternalWindow();
    if (!destination) { setError('Autorisez l’ouverture de Wave dans votre navigateur, puis réessayez.'); return; }
    try {
      await destination.navigate(supportWaveUrl());
      setPaidVia('wave');
    } catch { destination.close(); setError('Wave n’a pas pu être ouvert. Réessayez ou choisissez WhatsApp.'); }
  };
  const copyAlias = async () => {
    setError(''); setCopied(false);
    try { await navigator.clipboard.writeText(PISPI_ALIAS); }
    catch {
      let ok = false;
      try { aliasInput.current?.focus(); aliasInput.current?.select(); ok = !!document.execCommand?.('copy'); } catch {}
      if (!ok) { setError('Copie indisponible : appuyez longuement sur l’alias pour le copier.'); return; }
    }
    setCopied(true); setPaidVia('pispi');
  };
  const whatsapp = () => openSupportWhatsApp({ paidVia: paidVia || undefined });

  const METHODS = [
    { id: 'wave', name: 'Wave', Icon: Wallet },
    { id: 'pispi', name: 'PI-SPI', Icon: Landmark },
    { id: 'whatsapp', name: 'WhatsApp', Icon: MessageCircle },
  ];

  return (
    <Modal className="sg-overlay" onClose={() => onAnswer('close')} labelledBy={id + '-title'}>
      <div className="sg-box support-box">
        <button type="button" className="sg-close" aria-label="Fermer" onClick={() => onAnswer('close')}>
          <X size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="sg-hero-icon"><HandHeart size={40} strokeWidth={1.7} aria-hidden="true" /></div>
        <h2 id={id + '-title'}>Soutenir ASRAR PRO</h2>
        <p className="sg-sub">
          Si ASRAR PRO vous est utile, vous pouvez soutenir son développement et ses nouveaux contenus, du montant de
          votre choix.
        </p>

        <div className="subscription-simple support-pay">
          <div className="subscription-payment-choices" role="radiogroup" aria-label="Moyen de contribution">
            {METHODS.map(({ id: m, name, Icon }) => (
              <label key={m} className={`subscription-method subscription-method-${m}`}>
                <input type="radio" name={id + '-method'} value={m} aria-label={name} checked={method === m}
                  onChange={() => { setMethod(m); setError(''); setCopied(false); }} />
                <span className="subscription-method-icon" aria-hidden="true"><Icon size={24} strokeWidth={1.8} /></span>
                <span className="subscription-method-name">{name}</span>
                {method === m && <span className="subscription-method-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>}
              </label>
            ))}
          </div>

          {method === 'wave' && (
            <>
              <p className="support-hint">Wave s’ouvre sur le compte d’ASRAR PRO : vous saisissez vous-même le montant.</p>
              <button type="button" className="subscription-continue" onClick={openWave}>
                <Wallet size={17} aria-hidden="true" /> Contribuer avec Wave
              </button>
            </>
          )}
          {method === 'pispi' && (
            <section className="subscription-pispi" aria-label="Contribution par PI-SPI">
              <label htmlFor={id + '-alias'}>Alias du bénéficiaire</label>
              <textarea ref={aliasInput} id={id + '-alias'} value={PISPI_ALIAS} readOnly rows={2} spellCheck={false} autoCapitalize="none" dir="ltr" />
              <p>Dans votre application compatible PI-SPI, choisissez Envoyer, collez cet alias et indiquez le montant de votre choix. Vérifiez le nom du bénéficiaire avant de confirmer.</p>
              <button type="button" className="subscription-continue" onClick={copyAlias}>
                <Copy size={17} aria-hidden="true" /> {copied ? 'Alias copié' : 'Copier l’alias PI-SPI'}
              </button>
            </section>
          )}
          {method === 'whatsapp' && (
            <>
              <p className="support-hint">Écrivez-nous sur WhatsApp : nous vous indiquerons comment contribuer.</p>
              <button type="button" className="subscription-continue" onClick={whatsapp}>
                <MessageCircle size={17} aria-hidden="true" /> Écrire sur WhatsApp
              </button>
            </>
          )}
          {paidVia && method !== 'whatsapp' && (
            <button type="button" className="subscription-proof" onClick={whatsapp}>
              <MessageCircle size={17} aria-hidden="true" /> Envoyer le justificatif sur WhatsApp (facultatif)
            </button>
          )}
          {error && <p className="subscription-error" role="alert">{error}</p>}
          <p className="subscription-simple-note">
            <LockKeyhole size={13} aria-hidden="true" />
            <span>Contribution volontaire, en plus de l’éventuel abonnement : elle ne modifie pas votre accès. Voir <Link href="/compte" onClick={() => onAnswer('close')}>mon abonnement</Link>.</span>
          </p>
        </div>

        <div className="support-actions">
          <button type="button" className="support-later" onClick={() => onAnswer('later')}>Plus tard</button>
          <button type="button" className="support-done" onClick={() => onAnswer('contributed')}>J’ai déjà contribué</button>
        </div>
      </div>
    </Modal>
  );
}
