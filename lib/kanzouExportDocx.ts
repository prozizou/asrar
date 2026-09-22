"use client";
// lib/kanzouExportDocx.ts — porté depuis prozizou/Kanzou (voir lib/kanzouWafq.ts
// pour le contexte du portage) : export d'un carré numérique en document
// Word (.docx). Utilise le package `docx` déjà présent dans ce projet
// (lib/alqalamWorker.js, export Word d'Al-Qalam) — API vérifiée compatible
// entre les deux versions (v8 ici, v9 dans Kanzou), aucune adaptation requise.

import {
  AlignmentType,
  BorderStyle,
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

  // Bordure visible uniquement autour des cases réellement utilisées :
  // les null de diamond8ToRows/hatimTriangleToRows ne sont là que pour
  // centrer chaque rangée (silhouette du losange/triangle, voir leurs
  // docstrings dans lib/kanzouWafq.ts) — les border/texte "—" d'origine
  // sur CES cases dessinaient un rectangle plein, effaçant la silhouette
  // que le tableau est censé reproduire. Une case null reste donc vide
  // ET sans bordure ; les bordures par défaut du tableau sont désactivées
  // (voir `borders` sur `Table` ci-dessous) pour ne pas les faire
  // réapparaître derrière ce réglage par cellule.
  const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "auto" };
  const SINGLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "auto" };

  const tableRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map((cell) => {
          const empty = cell === null || cell === undefined;
          const border = empty ? NO_BORDER : SINGLE_BORDER;
          return new TableCell({
            width: { size: cellWidth, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: { top: border, bottom: border, left: border, right: border },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: empty
                  ? []
                  : [new TextRun({ text: String(cell), bold: true })],
              }),
            ],
          });
        }),
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
            // Désactivées ici : sans ça, docx applique ses bordures de
            // tableau par défaut derrière le réglage par cellule
            // ci-dessus, ce qui ferait réapparaître un rectangle plein
            // autour des cases vides du losange/triangle.
            borders: {
              top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
              insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
            },
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
