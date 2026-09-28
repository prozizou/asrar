// Module « Al-Qalam » — GÉOMÉTRIE VECTORIELLE d'une page d'ornement.
//
// Transforme une page composée par composePhrasePages (lib/alqalamOrne.js :
// positions du texte, des boucles et des liaisons) en TRACÉS SVG prêts à
// afficher et à exporter en PDF vectoriel :
//
//   • le texte courant devient les contours réels des glyphes de la police
//     (lib/alqalamShaper.js) — plus de rendu de texte par le navigateur ni
//     par un canvas, donc plus de pixellisation ;
//   • chaque boucle, ses liaisons (tatweel) et la lettre de bord qu'elles
//     rejoignent sont FUSIONNÉES en une seule forme par une vraie union de
//     polygones (Clipper) — plus de rectangles indépendants superposés, plus
//     de fond blanc qui recouvre une liaison, plus de couture visible ;
//   • les angles rentrants de cette forme (liaison ↔ cercle) sont arrondis
//     par une fermeture morphologique (dilatation puis érosion d'une même
//     distance) : un congé organique, comme un trait de calame, au lieu
//     d'un raccord à angle droit ;
//   • le vœu intérieur devient lui aussi des contours ; chaque ligne n'est
//     décrite qu'une fois par page (<defs>) puis réutilisée (<use>) dans
//     toutes les boucles — le PDF la stocke une seule fois.
//
// Pur calcul, sans DOM : testé sous Node avec la vraie police
// (lib/alqalamVector.test.js).
import ClipperLib from 'clipper-lib';
import { bowlPath, ARC_SPAN } from './alqalamOrne';

// Clipper travaille en entiers : coordonnées multipliées par CS.
const CS = 1000;
const r2 = (v) => Math.round(v * 100) / 100;

// ── Lecture / transformation des contours de glyphes ───────────────────────
// HarfBuzz produit des chemins absolus « M x,y L x,y Q x,y x,y C … Z ».
const TOKEN = /[MLQCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

function parsePath(d) {
  const tokens = String(d || '').match(TOKEN) || [];
  const cmds = [];
  let i = 0;
  while (i < tokens.length) {
    const c = tokens[i++].toUpperCase();
    const arity = c === 'M' || c === 'L' ? 2 : c === 'Q' ? 4 : c === 'C' ? 6 : 0;
    const nums = [];
    for (let k = 0; k < arity; k += 1) nums.push(Number(tokens[i++]));
    cmds.push({ c, nums });
  }
  return cmds;
}

/** Réécrit un chemin en appliquant `fn(x, y) → [x, y]` à chaque point (les courbes restent des courbes). */
function transformPath(cmds, fn) {
  let out = '';
  for (const { c, nums } of cmds) {
    out += c;
    for (let k = 0; k < nums.length; k += 2) {
      const [x, y] = fn(nums[k], nums[k + 1]);
      out += (k ? ' ' : '') + r2(x) + ',' + r2(y);
    }
  }
  return out;
}

/**
 * Aplatit un chemin en polygones (points Clipper entiers), après
 * transformation. Les courbes sont subdivisées assez finement pour que
 * l'écart reste invisible (≈ 1/100 d'unité de composition).
 */
function flattenPath(cmds, fn) {
  const polys = [];
  let cur = null;
  let px = 0;
  let py = 0;
  const push = (x, y) => cur.push({ X: Math.round(x * CS), Y: Math.round(y * CS) });
  for (const { c, nums } of cmds) {
    if (c === 'M') {
      if (cur && cur.length > 2) polys.push(cur);
      cur = [];
      [px, py] = fn(nums[0], nums[1]);
      push(px, py);
    } else if (c === 'L') {
      [px, py] = fn(nums[0], nums[1]);
      push(px, py);
    } else if (c === 'Q' || c === 'C') {
      const pts = [[px, py]];
      for (let k = 0; k < nums.length; k += 2) pts.push(fn(nums[k], nums[k + 1]));
      const [ex, ey] = pts[pts.length - 1];
      // Nombre de segments tel que l'écart à la courbe reste < 0,02 unité
      // (≈ 4 µm) : borné par la dérivée seconde (courbure) du segment.
      let dd = 0;
      for (let k = 0; k + 2 < pts.length; k += 1) {
        dd = Math.max(dd, Math.hypot(pts[k][0] - 2 * pts[k + 1][0] + pts[k + 2][0], pts[k][1] - 2 * pts[k + 1][1] + pts[k + 2][1]));
      }
      const steps = Math.max(1, Math.min(24, Math.ceil(Math.sqrt((c === 'C' ? 0.75 : 0.25) * dd / 0.02))));
      for (let s = 1; s <= steps; s += 1) {
        const t = s / steps;
        const u = 1 - t;
        let x;
        let y;
        if (c === 'Q') {
          x = u * u * pts[0][0] + 2 * u * t * pts[1][0] + t * t * pts[2][0];
          y = u * u * pts[0][1] + 2 * u * t * pts[1][1] + t * t * pts[2][1];
        } else {
          x = u * u * u * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t * t * t * pts[3][0];
          y = u * u * u * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t * t * t * pts[3][1];
        }
        push(x, y);
      }
      [px, py] = [ex, ey];
    } else if (c === 'Z') {
      if (cur && cur.length > 2) polys.push(cur);
      cur = null;
    }
  }
  if (cur && cur.length > 2) polys.push(cur);
  return polys;
}

// ── Opérations Clipper ─────────────────────────────────────────────────────
function union(paths) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const out = new ClipperLib.Paths();
  c.Execute(ClipperLib.ClipType.ctUnion, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out;
}

function intersect(paths, clip) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const out = new ClipperLib.Paths();
  c.Execute(ClipperLib.ClipType.ctIntersection, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out;
}

// Tolérance des arcs et du nettoyage : 0,03 unité ≈ 5 µm sur la feuille —
// invisible, même agrandi, mais sans multiplier inutilement les points.
function offset(paths, delta, endType = ClipperLib.EndType.etClosedPolygon) {
  const co = new ClipperLib.ClipperOffset(2, 0.03 * CS);
  co.AddPaths(paths, ClipperLib.JoinType.jtRound, endType);
  const out = new ClipperLib.Paths();
  co.Execute(out, delta * CS);
  return ClipperLib.Clipper.CleanPolygons(out, 0.03 * CS);
}

const box = (x, y, h) => [[
  { X: Math.round((x - h) * CS), Y: Math.round((y - h) * CS) },
  { X: Math.round((x + h) * CS), Y: Math.round((y - h) * CS) },
  { X: Math.round((x + h) * CS), Y: Math.round((y + h) * CS) },
  { X: Math.round((x - h) * CS), Y: Math.round((y + h) * CS) },
]];

function toSvg(paths) {
  let d = '';
  for (const path of paths) {
    if (path.length < 3) continue;
    d += 'M' + path.map((p) => r2(p.X / CS) + ',' + r2(p.Y / CS)).join('L') + 'Z';
  }
  return d;
}

/**
 * Anneau d'épaisseur constante 2h autour d'un contour fermé CONVEXE (les
 * boucles le sont toutes) : décalage exact le long de la normale en chaque
 * point — un seul point par sommet, là où un décalage générique en crée
 * trois. Aux angles vifs (base d'un dôme), le bord extérieur suit un arc
 * de rayon h (bout arrondi, comme un trait de calame) et le bord intérieur
 * se coupe en onglet — arrondi ensuite par le congé de jonction.
 * @returns {any[]} [extérieur, intérieur] orientés en sens contraires.
 */
function ringPaths(points, h) {
  const n = points.length;
  let area = 0;
  for (let i = 0; i < n; i += 1) {
    const p = points[i];
    const q = points[(i + 1) % n];
    area += p.x * q.y - q.x * p.y;
  }
  const sgn = area > 0 ? 1 : -1;
  const normal = (dx, dy) => {
    const len = Math.hypot(dx, dy) || 1;
    return { x: (sgn * dy) / len, y: (-sgn * dx) / len };
  };
  const outer = [];
  const inner = [];
  const pt = (x, y) => ({ X: Math.round(x * CS), Y: Math.round(y * CS) });
  for (let i = 0; i < n; i += 1) {
    const prev = points[(i - 1 + n) % n];
    const p = points[i];
    const next = points[(i + 1) % n];
    const n1 = normal(p.x - prev.x, p.y - prev.y);
    const n2 = normal(next.x - p.x, next.y - p.y);
    const cos = Math.max(-1, Math.min(1, n1.x * n2.x + n1.y * n2.y));
    const turn = Math.acos(cos);
    const mx = n1.x + n2.x;
    const my = n1.y + n2.y;
    const ml = Math.hypot(mx, my) || 1;
    const miter = h / Math.max(0.2, Math.cos(turn / 2));
    if (turn < 0.35) {
      outer.push(pt(p.x + (mx / ml) * miter, p.y + (my / ml) * miter));
    } else {
      const a0 = Math.atan2(n1.y, n1.x);
      let da = Math.atan2(n2.y, n2.x) - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const steps = Math.max(2, Math.ceil(Math.abs(da) / 0.12));
      for (let k = 0; k <= steps; k += 1) {
        const a = a0 + (da * k) / steps;
        outer.push(pt(p.x + Math.cos(a) * h, p.y + Math.sin(a) * h));
      }
    }
    inner.push(pt(p.x - (mx / ml) * miter, p.y - (my / ml) * miter));
  }
  return [outer, inner.reverse()];
}

/** Points d'un contour de boucle (bowlPath), translatés au centre (cx, cy). */
function bowlPoints(bowl, cx, cy) {
  return String(bowl)
    .replace(/[MLZ]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((pt) => {
      const [x, y] = pt.split(',').map(Number);
      return { X: Math.round((cx + x) * CS), Y: Math.round((cy + y) * CS) };
    });
}

/**
 * Trait vertical traversé par la verticale x = sx dans des polygones
 * (règle non nulle, celle des polices) : l'intervalle [top, bottom] le plus
 * proche de `near`, s'il en est à moins de `maxDist`. Sert à lire la hauteur
 * et l'épaisseur RÉELLES du trait de liaison d'une lettre.
 */
function strokeAt(polys, sx, near, maxDist) {
  const X = sx * CS;
  const hits = [];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i += 1) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      if ((p.X <= X && q.X > X) || (q.X <= X && p.X > X)) {
        const y = p.Y + ((X - p.X) * (q.Y - p.Y)) / (q.X - p.X);
        hits.push({ y: y / CS, w: q.X > p.X ? 1 : -1 });
      }
    }
  }
  hits.sort((a, b) => a.y - b.y);
  let winding = 0;
  let start = 0;
  let best = null;
  for (const h of hits) {
    const before = winding;
    winding += h.w;
    if (before === 0 && winding !== 0) start = h.y;
    else if (before !== 0 && winding === 0) {
      const mid = (start + h.y) / 2;
      const dist = Math.abs(mid - near);
      if (dist <= maxDist && (!best || dist < best.dist)) best = { top: start, bottom: h.y, dist };
    }
  }
  return best;
}

// ── Page ────────────────────────────────────────────────────────────────────
/**
 * @param {{W:number, H:number, items:any[], connectors:any[]}} page
 * @param {ReturnType<import('./alqalamShaper').createShaper>} shaper
 * @param {{idPrefix?: string}} [opts] préfixe des identifiants <defs> — unique par page
 * @returns {{
 *   W:number, H:number,
 *   ink:string, text:string,
 *   defs:{id:string, d:string}[],
 *   uses:{href:string, transform:string}[],
 *   emptyLoops:{cx:number, cy:number}[],
 * }}
 */
export function vectorizePage(page, shaper, { idPrefix = 'q' } = {}) {
  const { upem } = shaper;
  const fused = new Set(); // "item:glyph" déjà intégrés à la forme fusionnée
  const edgeGlyphs = []; // polygones des lettres de bord à fusionner

  // Glyphes placés d'un élément de texte : chacun avec sa transformation
  // (unités de police → page) et sa boîte d'encre sur la page.
  const placedCache = new Map();
  const placed = (index) => {
    if (placedCache.has(index)) return placedCache.get(index);
    const item = page.items[index];
    const s = item.fontSize / upem;
    const { advance, glyphs } = shaper.shape(item.value);
    const chars = item.value;
    const spaces = (chars.match(/ /g) || []).length;
    const total = advance * s + spaces * (item.wordSpacing || 0);
    const left = item.x - total / 2;
    let extra = 0;
    const list = glyphs.map((g) => {
      const ox = left + g.x * s + extra;
      const oy = item.y - g.y * s;
      if (chars[g.cluster] === ' ') extra += item.wordSpacing || 0;
      const fn = (x, y) => [ox + x * s, oy - y * s];
      const box = shaper.glyphBox(g.gid);
      const pageBox = box ? { xMin: ox + box.xMin * s, xMax: ox + box.xMax * s, yTop: oy - box.yMax * s, yBottom: oy - box.yMin * s } : null;
      return { gid: g.gid, fn, box: pageBox };
    });
    placedCache.set(index, list);
    return list;
  };

  // Lettre de bord qu'une liaison rejoint : celle dont l'encre traverse la
  // bande de la plume, la plus proche du bord concerné.
  const pickEdge = (index, side, bandTop, bandBottom) => {
    const list = placed(index);
    let best = -1;
    list.forEach((g, gi) => {
      if (!g.box || !shaper.glyphPath(g.gid)) return;
      if (g.box.yTop > bandBottom || g.box.yBottom < bandTop) return;
      if (best < 0) best = gi;
      else if (side === 'left' ? g.box.xMin < list[best].box.xMin : g.box.xMax > list[best].box.xMax) best = gi;
    });
    return best;
  };

  // 1. Formes propres à l'ornement : anneaux des boucles + liaisons.
  const own = [];
  // Points de jonction où arrondir les angles rentrants : bouts des
  // liaisons côté boucle, et coins intérieurs de la base des dômes.
  const joints = [];
  for (const item of page.items) {
    if (item.type !== 'loop') continue;
    // 120 points suffisent (écart à la courbe vraie < 0,04 unité) : le
    // décalage de Clipper arrondit ensuite chaque angle.
    const outline = bowlPath(item.a, item.b, item.n, 120, item.arc ? ARC_SPAN : Math.PI * 2);
    const pts = bowlPoints(outline, item.cx, item.cy).map((q) => ({ x: q.X / CS, y: q.Y / CS }));
    own.push(...ringPaths(pts, item.stroke / 2));
    if (item.arc) joints.push({ x: item.cx - item.a, y: item.cy }, { x: item.cx + item.a, y: item.cy });
  }
  let pen = 0;
  for (const c of page.connectors) {
    pen = Math.max(pen, c.width);
    let right = Math.max(c.x1, c.x2);
    let left = Math.min(c.x1, c.x2);
    let yTop = c.y - c.width / 2;
    let yBot = c.y + c.width / 2;
    // Côté texte, la liaison ÉPOUSE le trait de liaison réel de la lettre :
    // sa hauteur et son épaisseur sont lues sur le contour du glyphe, là où
    // il se raccorde — jamais une valeur fixe (signalé : « la liaison paraît
    // plus artificielle que les traits calligraphiques »). Chaque police
    // attache ses lettres à une hauteur légèrement différente du tatweel.
    for (const [index, side] of [[c.rightItem, 'left'], [c.leftItem, 'right']]) {
      if (index === null || index === undefined) continue;
      const gi = pickEdge(index, side, yTop, yBot);
      if (gi < 0) continue;
      const g = placed(index)[gi];
      const polys = flattenPath(parsePath(shaper.glyphPath(g.gid)), g.fn);
      const inset = page.items[index].fontSize * 0.04;
      const sx = side === 'left' ? g.box.xMin + inset : g.box.xMax - inset;
      const run = strokeAt(polys, sx, c.y, page.items[index].fontSize * 0.25);
      if (run) {
        yTop = run.top;
        yBot = run.bottom;
        // Arrêtée EXACTEMENT au point mesuré, à l'intérieur du trait : au-delà,
        // son coin ressortirait sous la courbe de la lettre (dents du س…).
        if (side === 'left') right = sx;
        else left = sx;
      }
      const key = index + ':' + gi;
      if (!fused.has(key)) {
        fused.add(key);
        edgeGlyphs.push(...polys);
      }
    }
    if (c.rightItem === null || c.rightItem === undefined) joints.push({ x: Math.max(c.x1, c.x2), y: c.y });
    if (c.leftItem === null || c.leftItem === undefined) joints.push({ x: Math.min(c.x1, c.x2), y: c.y });
    own.push([
      { X: Math.round(left * CS), Y: Math.round(yTop * CS) },
      { X: Math.round(right * CS), Y: Math.round(yTop * CS) },
      { X: Math.round(right * CS), Y: Math.round(yBot * CS) },
      { X: Math.round(left * CS), Y: Math.round(yBot * CS) },
    ]);
  }

  // 2. Union, puis congés : fermeture morphologique (+f puis −f) — ne
  //    touche que les angles RENTRANTS (jonction liaison/cercle), jamais
  //    l'épaisseur des traits.
  //    Appliquée LOCALEMENT, dans un petit carré autour de chaque jonction :
  //    le résultat est le même qu'à l'échelle de la page (la fermeture ne
  //    change rien loin des angles rentrants), pour une fraction du calcul.
  let ink = own.length ? union(own) : [];
  if (ink.length && joints.length) {
    const t = pen || page.items.find((i) => i.type === 'loop')?.stroke || 0;
    const f = t * 0.45;
    const fillets = [];
    const h = t * 2 + f * 4;
    // Seuls les contours proches d'une jonction entrent dans son calcul.
    const bounds = own.map((path) => {
      let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
      for (const p of path) {
        if (p.X < x0) x0 = p.X; if (p.X > x1) x1 = p.X;
        if (p.Y < y0) y0 = p.Y; if (p.Y > y1) y1 = p.Y;
      }
      return { x0, x1, y0, y1 };
    });
    for (const j of joints) {
      const bx0 = (j.x - h) * CS; const bx1 = (j.x + h) * CS;
      const by0 = (j.y - h) * CS; const by1 = (j.y + h) * CS;
      const near = own.filter((_, i) => bounds[i].x1 >= bx0 && bounds[i].x0 <= bx1 && bounds[i].y1 >= by0 && bounds[i].y0 <= by1);
      const piece = intersect(union(near), box(j.x, j.y, h));
      if (piece.length) fillets.push(...offset(offset(piece, f), -f));
    }
    if (fillets.length) ink = union([...ink, ...fillets]);
  }
  // 3. Fusion avec les lettres de bord (leurs contours normalisés d'abord,
  //    pour que l'orientation de la police ne creuse rien à l'union).
  if (edgeGlyphs.length) ink = union([...ink, ...union(edgeGlyphs)]);

  // 4. Texte courant restant : contours de la police, courbes conservées.
  let text = '';
  page.items.forEach((item, index) => {
    if (item.type !== 'text') return;
    placed(index).forEach((g, gi) => {
      if (fused.has(index + ':' + gi)) return;
      const d = shaper.glyphPath(g.gid);
      if (d) text += transformPath(parsePath(d), g.fn);
    });
  });

  // 5. Vœu intérieur : une définition par ligne distincte, réutilisée.
  const defs = [];
  const defIds = new Map();
  const uses = [];
  const emptyLoops = [];
  for (const item of page.items) {
    if (item.type !== 'loop') continue;
    if (!item.inner) {
      emptyLoops.push({ cx: item.cx, cy: item.cy });
      continue;
    }
    const s = item.inner.fontSize / upem;
    for (const line of item.inner.lines) {
      const { advance, glyphs } = shaper.shape(line.text);
      let id = defIds.get(line.text);
      if (!id) {
        id = `${idPrefix}${defs.length}`;
        let d = '';
        for (const g of glyphs) {
          const gd = shaper.glyphPath(g.gid);
          if (gd) d += transformPath(parsePath(gd), (x, y) => [g.x + x, g.y + y]);
        }
        defs.push({ id, d });
        defIds.set(line.text, id);
      }
      const x0 = item.cx - (advance * s) / 2;
      const y0 = item.cy + line.y;
      uses.push({ href: '#' + id, transform: `matrix(${s.toFixed(6)} 0 0 ${(-s).toFixed(6)} ${r2(x0)} ${r2(y0)})` });
    }
  }

  return { W: page.W, H: page.H, ink: toSvg(ink), text, defs, uses, emptyLoops };
}

const escapeXml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

/**
 * Balisage SVG COMPLET d'une page vectorisée — le même pour l'aperçu et le
 * PDF : ce qui s'affiche est exactement ce qui s'exporte. Uniquement des
 * tracés (aucun texte arabe laissé au moteur de rendu), en noir sur blanc.
 * @param {ReturnType<typeof vectorizePage>} v
 * @param {{pageNumber:number, pageCount:number, label?:string, margin:number}} opts
 */
export function pageSvgMarkup(v, { pageNumber, pageCount, label = '', margin }) {
  const defs = v.defs.map((d) => `<path id="${d.id}" d="${d.d}" fill="#000"/>`).join('');
  const uses = v.uses.map((u) => `<use href="${u.href}" transform="${u.transform}"/>`).join('');
  const empty = v.emptyLoops
    .map((e) => `<text x="${r2(e.cx)}" y="${r2(e.cy + 4)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#a22">Texte trop long</text>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="orne-svg" viewBox="0 0 ${v.W} ${r2(v.H)}" role="img" aria-label="${escapeXml(label)}">` +
    `<rect x="0" y="0" width="${v.W}" height="${r2(v.H)}" fill="#fff"/>` +
    (defs ? `<defs>${defs}</defs>` : '') +
    (v.ink ? `<path d="${v.ink}" fill="#000"/>` : '') +
    (v.text ? `<path d="${v.text}" fill="#000"/>` : '') +
    (uses ? `<g fill="#000">${uses}</g>` : '') +
    empty +
    // Numérotation dans la marge basse, hors de la zone calligraphique.
    `<text x="${v.W / 2}" y="${r2(v.H - margin - 4)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#333">${pageNumber} / ${pageCount}</text>` +
    '</svg>'
  );
}
