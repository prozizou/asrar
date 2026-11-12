'use client';
// Porté depuis prozizou/Kanzou components/ExportWordButton.tsx —
// lib/kanzouExportDocx.ts (le package `docx` est déjà une dépendance de ce
// projet, cf. son en-tête). Import DYNAMIQUE (pas en tête de fichier) :
// `docx` est une librairie volumineuse — sans ça, elle alourdirait le JS
// initial des 9 pages /wafq/carre/[taille] même pour qui n'exporte jamais.
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useSupport } from '@/components/SupportProvider';

export default function ExportWordButton({
  title,
  subtitle,
  rows,
  fileName,
}: {
  title: string;
  subtitle?: string;
  rows: (string | number | null)[][];
  fileName: string;
}) {
  // Fenêtre « Soutenir ASRAR PRO » après une réussite (règle : lib/supportPrompt.js).
  const { celebrate } = useSupport();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const { exportSquareToDocx } = await import('@/lib/kanzouExportDocx');
      await exportSquareToDocx({ title, subtitle, rows, fileName });
      celebrate();
    } catch {
      // Échec silencieux (ex. Blob non supporté) : pas de UI d'erreur dédiée
      // pour un simple export, même choix que la version d'origine.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="kz-export-btn" onClick={handleClick} disabled={busy}>
      {busy ? '…' : <><Download size={16} aria-hidden="true" /> Word (.docx)</>}
    </button>
  );
}
