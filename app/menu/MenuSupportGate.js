'use client';
// Fenêtre « Soutenir ASRAR PRO » à l'ouverture du menu (page la plus
// visitée) : une fois par session, « Passer » après 5 s. Règles :
// lib/supportPrompt.js (shouldPromptMenu) ; affichage : SupportProvider.
import { useEffect } from 'react';
import { useSupport } from '@/components/SupportProvider';

export default function MenuSupportGate() {
  const { menuGate } = useSupport();
  useEffect(() => menuGate(), [menuGate]);
  return null;
}
