export function serializeMagicStar(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('class');
  clone.setAttribute('style', '--star-surface:#fff;--star-ink:#151515;--star-value:#c1121f');
  clone.setAttribute('width', '1920');
  clone.setAttribute('height', '2010');
  return new XMLSerializer().serializeToString(clone);
}

export async function magicStarImage(svg: SVGSVGElement, format: 'svg' | 'png'): Promise<Blob> {
  const source = new Blob([serializeMagicStar(svg)], { type: 'image/svg+xml;charset=utf-8' });
  if (format === 'svg') return source;
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1920; canvas.height = 2010;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image indisponible');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
      if (blob) resolve(blob); else reject(new Error('Image indisponible'));
    }, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
