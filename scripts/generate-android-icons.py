"""Génère des icônes Android nettes à partir de public/assets/logo-full.png (640 px).

Usage : python3 scripts/generate-android-icons.py . android/app/src/main/res   (nécessite Pillow)

- ic_launcher_foreground (couche avant de l'icône adaptative) : 108 dp par densité
  (108/162/216/324/432 px), logo dans la zone sûre (cercle de 66 dp).
- ic_launcher / ic_launcher_round (anciens lanceurs) : 48/72/96/144/192 px.
- splash_icon (écran de démarrage Android 12+) : 288 dp par densité, logo dans le cercle visible de 192 dp.
Toujours des réductions (Lanczos) depuis la source : aucune taille n'est agrandie, donc aucun flou.
Les anciennes couches avant faisaient 48 à 192 px au lieu de 108 dp : Android les agrandissait ~2,25×.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

repo = Path(sys.argv[1]); out = Path(sys.argv[2])
assert out.is_dir(), out
src = Image.open(repo / 'public/assets/logo-full.png').convert('RGBA')

# Couleur du fond clair du logo : la plus fréquente à l'intérieur du cercle (hors texte).
from collections import Counter
cw, ch = src.size
counts = Counter()
for y in range(0, ch, 2):
    for x in range(0, cw, 2):
        if (x - cw / 2) ** 2 + (y - ch / 2) ** 2 < (cw / 2 - 30) ** 2:
            r, g, b, a = src.getpixel((x, y))
            if a > 250:
                counts[(r, g, b)] += 1
BG = counts.most_common(1)[0][0]

# Boîte englobante du texte : pixels nettement plus sombres ou colorés que le fond.
px = src.load(); w, h = src.size
def ink(p):
    r, g, b, a = p
    return a > 200 and (abs(r - BG[0]) + abs(g - BG[1]) + abs(b - BG[2])) > 90
xs, ys = [], []
for y in range(h):
    for x in range(w):
        # rester à l'intérieur du cercle (évite le liseré gris du bord)
        if (x - w / 2) ** 2 + (y - h / 2) ** 2 < (w / 2 - 18) ** 2 and ink(px[x, y]):
            xs.append(x); ys.append(y)
box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
text = src.crop(box)
tw, th = text.size
print('fond', BG, 'texte', box, tw, 'x', th)

def compose(canvas_px, max_diag_ratio, shape=None):
    """Logo centré sur fond clair ; diagonale du texte = max_diag_ratio × côté."""
    canvas = Image.new('RGBA', (canvas_px, canvas_px), BG + (255,))
    diag = (tw ** 2 + th ** 2) ** 0.5
    scale = max_diag_ratio * canvas_px / diag
    t = text.resize((max(1, round(tw * scale)), max(1, round(th * scale))), Image.LANCZOS)
    canvas.alpha_composite(t, ((canvas_px - t.width) // 2, (canvas_px - t.height) // 2))
    if shape:
        mask = Image.new('L', (canvas_px * 4, canvas_px * 4), 0)
        d = ImageDraw.Draw(mask)
        if shape == 'round':
            d.ellipse((0, 0, canvas_px * 4 - 1, canvas_px * 4 - 1), fill=255)
        else:
            d.rounded_rectangle((0, 0, canvas_px * 4 - 1, canvas_px * 4 - 1), radius=canvas_px * 4 * 0.22, fill=255)
        mask = mask.resize((canvas_px, canvas_px), Image.LANCZOS)
        clear = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
        canvas = Image.composite(canvas, clear, mask)
    return canvas, scale

dens = {'ldpi': 0.75, 'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
report = []
for name, f in dens.items():
    d = out / f'mipmap-{name}'; d.mkdir(parents=True, exist_ok=True)
    # Icône adaptative : 72 dp visibles sur 108 (zone sûre stricte : cercle de 66 dp). Diagonale du
    # texte = 0,64 × 108 dp : même encombrement qu'avant, coins du cadre du texte (vides) au bord du cercle.
    fg, s1 = compose(round(108 * f), 0.64)
    fg.save(d / 'ic_launcher_foreground.png', optimize=True)
    sq, _ = compose(round(48 * f), 0.80, 'square'); sq.save(d / 'ic_launcher.png', optimize=True)
    rd, _ = compose(round(48 * f), 0.74, 'round'); rd.save(d / 'ic_launcher_round.png', optimize=True)
    ds = out / f'drawable-{name}'; ds.mkdir(parents=True, exist_ok=True)
    # Écran de démarrage : 288 dp, cercle visible de 192 dp. Diagonale du texte = 0,49 × 288 :
    # le logo occupe ~74 % du cercle et n'est jamais agrandi, même en xxxhdpi (1152 px).
    sp, s2 = compose(round(288 * f), 0.49)
    sp.save(ds / 'splash_icon.png', optimize=True)
    report.append((name, round(108 * f), round(s1, 2), round(288 * f), round(s2, 2)))
for r in report:
    print('%-8s premier plan %4d px (échelle %.2f) | démarrage %4d px (échelle %.2f)' % r)
