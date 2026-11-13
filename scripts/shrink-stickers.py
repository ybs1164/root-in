"""Shrinks sticker PNGs in place: public/stickers itself (done 2026-10-28,
~150MB -> ~34MB) and, for anything added since, the built copies.

The originals were ~1254px, but a sticker is never drawn wider than 0.6 of
the 1400px share scene (~840px), so 768px is plenty. Flat art (doodles,
stationery, pixel) also survives a 256-colour palette; painted and chrome
art bands, so it stays full colour. Which way each one goes is measured, not
listed: the palette version is kept only if it is close to the resized
original (PSNR on visible pixels). A file it can't make smaller is left as
it is, so a second run settles it and later runs change nothing.

  python scripts/shrink-stickers.py [dir]   (default dist/stickers; new art: public/stickers)

Map place stickers (public/poi-stickers, 2026-11-13: 1536px art, ~74MB) are
drawn in a 48px square scaled by POI_STICKER_SCALE (at most ~2.8, ~133 CSS px,
~400 device px on a 3x phone), so they take --max-side 512:

  python scripts/shrink-stickers.py public/poi-stickers --max-side 512

Shrinking keeps the aspect ratio, so poiStickerScale/poiStickerBounds hold.
"""
import io
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops

MAX_SIDE = 768
# Flat art lands at 42dB and up; painted/crayon/chrome art below it.
PALETTE_MIN_PSNR = 42.0


def on_grey(im: Image.Image) -> Image.Image:
    return Image.alpha_composite(Image.new('RGBA', im.size, (128, 128, 128, 255)), im).convert('RGB')


def psnr(a: Image.Image, b: Image.Image) -> float:
    hist = ImageChops.difference(on_grey(a), on_grey(b)).histogram()
    se = sum((i % 256) ** 2 * c for i, c in enumerate(hist))
    if se == 0:
        return 99.0
    return 10 * math.log10(255 ** 2 / (se / (a.size[0] * a.size[1] * 3)))


def png_bytes(im: Image.Image) -> bytes:
    out = io.BytesIO()
    im.save(out, 'PNG', optimize=True)
    return out.getvalue()


def shrink(path: Path, max_side: int = MAX_SIDE) -> tuple[int, int, str]:
    before = path.stat().st_size
    im = Image.open(path).convert('RGBA')
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    pal = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    if psnr(im, pal.convert('RGBA')) >= PALETTE_MIN_PSNR:
        data, kind = png_bytes(pal), 'palette'
    else:
        data, kind = png_bytes(im), 'full'
    if len(data) >= before:
        return before, before, 'kept'
    path.write_bytes(data)
    return before, len(data), kind


def main() -> None:
    args = sys.argv[1:]
    max_side = MAX_SIDE
    if '--max-side' in args:
        i = args.index('--max-side')
        max_side = int(args[i + 1])
        del args[i:i + 2]
    folder = Path(args[0] if args else 'dist/stickers')
    files = sorted(folder.glob('*.png'))
    total_before = total_after = 0
    kinds: dict[str, int] = {}
    for f in files:
        b, a, kind = shrink(f, max_side)
        total_before += b
        total_after += a
        kinds[kind] = kinds.get(kind, 0) + 1
    print(f'{folder.name}: {len(files)} files, {total_before / 1e6:.1f}MB -> {total_after / 1e6:.1f}MB {kinds}')


if __name__ == '__main__':
    main()
