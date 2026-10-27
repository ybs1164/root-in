"""Shrinks the built sticker PNGs (dist/stickers) for the Android APK.

The originals are ~1254px and ~150MB in all, but a sticker is never drawn
wider than 0.6 of the 1400px share scene (~840px), so 768px is plenty. Flat
art (doodles, stationery, pixel) also survives a 256-colour palette; painted
and chrome art bands, so it stays full colour. Which way each one goes is
measured, not listed: the palette version is kept only if it is close to the
resized original (PSNR on visible pixels). public/stickers is never touched.

  python scripts/shrink-stickers.py [dir]   (default dist/stickers)
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


def shrink(path: Path) -> tuple[int, int, str]:
    before = path.stat().st_size
    im = Image.open(path).convert('RGBA')
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
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
    folder = Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/stickers')
    files = sorted(folder.glob('*.png'))
    total_before = total_after = 0
    kinds: dict[str, int] = {}
    for f in files:
        b, a, kind = shrink(f)
        total_before += b
        total_after += a
        kinds[kind] = kinds.get(kind, 0) + 1
    print(f'Stickers: {len(files)} files, {total_before / 1e6:.1f}MB -> {total_after / 1e6:.1f}MB {kinds}')


if __name__ == '__main__':
    main()
