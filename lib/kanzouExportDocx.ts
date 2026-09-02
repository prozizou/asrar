"use client";
// lib/kanzouExportDocx.ts — porté depuis prozizou/Kanzou (voir lib/kanzouWafq.ts
// pour le contexte du portage) : export d'un carré numérique en document
// Word (.docx). Utilise le package `docx` déjà présent dans ce projet
// (lib/alqalamWorker.js, export Word d'Al-Qalam) — API vérifiée compatible
// entre les deux versions (v8 ici, v9 dans Kanzou), aucune adaptation requise.

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

/** Largeur totale du tableau, en twips (1/20e de point ; ~9000 = 15,6 cm). */
const TABLE_WIDTH_DXA = 9000;

export interface DocxSquareOptions {
  /** Titre affiché en en-tête du document (ex : "Carré 9 × 9 — Hatim"). */
  title: string;
  /** Sous-titre optionnel (ex : la valeur de base saisie). */
  subtitle?: string;
  /** Grille en ordre visuel : un tableau de lignes de cellules. */
  rows: (string | number | null)[][];
  /** Nom de fichier (avec ou sans extension .docx). */
  fileName: string;
}

/**
 * Génère un document Word (.docx) contenant le carré sous forme de
 * tableau, chaque nombre centré horizontalement et verticalement dans
 * sa cage, puis déclenche le téléchargement dans le navigateur.
 */
export async function exportSquareToDocx({
  title,
  subtitle,
  rows,
  fileName,
}: DocxSquareOptions): Promise<void> {
  const cols = rows[0]?.length ?? 1;
  const cellWidth = Math.floor(TABLE_WIDTH_DXA / cols);

  const tableRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              width: { size: cellWidth, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: cell === null || cell === undefined ? "—" : String(cell),
                      bold: true,
                    }),
                  ],
                }),
              ],
            })
        ),
      })
  );

  const headerParagraphs = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title })],
    }),
  ];

  if (subtitle) {
    headerParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: subtitle, italics: true })],
        spacing: { after: 200 },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        children: [
          ...headerParagraphs,
          new Table({
            width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
            // Sans ça, docx retombe sur 100 dxa/colonne par défaut
            // (~0,18 cm) quel que soit le nombre de colonnes.
            columnWidths: new Array(cols).fill(cellWidth),
            rows: tableRows,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
