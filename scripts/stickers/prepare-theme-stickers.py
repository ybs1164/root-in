"""Split the approved-chat sheets once, then recolor identical RGBA masks per app theme."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path('/Users/leeyeeun/.codex/generated_images/01a1ca04-2e8f-7623-a77d-56af3bd4a8be')
OUT = ROOT / 'public/stickers/theme-stationery-20261115'
OUT.mkdir(parents=True, exist_ok=True)
# main, strong, soft, milk: copied from src/styles.css; white stays white.
PALETTES = {
    'matcha': ['#a3c46f', '#6e9a3c', '#dfeac6', '#f3f7e9', '#ffffff'],
    'banana': ['#ffd85f', '#fea200', '#fce89d', '#fff7d8', '#ffffff'],
    'strawberry': ['#f48fa6', '#c94a6a', '#fcdbe3', '#fff0f3', '#ffffff'],
    'choco': ['#a8704b', '#6f4128', '#ecdccf', '#f7efe8', '#ffffff'],
}
THEMES = dict(matcha='말차', banana='바나나', strawberry='딸기', choco='초코')
SHEETS = [
    ('exec-02515eb4-87ea-43fb-8931-b3f98c66b168.png', ['닫힌 노트','펼친 노트','편지 봉투','메모지','겹친 사진 프레임','타원 라벨','티켓','책갈피','집게 클립','종이 클립','연필','만년필']),
    ('exec-4d1d27a3-a5ad-4234-8ac2-c7c0d5458917.png', ['넓은 리본','가는 리본','리본 배너','무지 테이프','사선 테이프','도트 테이프','교차 테이프','테이프 롤','원형 스티커','사각 스티커','선물 상자','종이 태그']),
    ('exec-64a67947-86d9-4fa7-9dab-b5afcac0d615.png', ['머그컵','라테','케이크','마카롱','도넛','아이스크림','에코백','헤드폰','즉석카메라','스탠드 조명','책','물병']),
]
assets = []
verification = []
for sheet_index, (filename, names) in enumerate(SHEETS):
    sheet = Image.open(SOURCE / filename).convert('RGBA')
    for index, name in enumerate(names):
        col, row = index % 3, index // 3
        box = (round(col * sheet.width / 3), round(row * sheet.height / 4), round((col + 1) * sheet.width / 3), round((row + 1) * sheet.height / 4))
        data = np.array(sheet.crop(box))
        # The generator left low-alpha colored dust. Keep the actual opaque illustration components.
        core = data[:, :, 3] >= 128
        core = ndimage.binary_opening(core, iterations=2)
        core = ndimage.binary_closing(core, iterations=2)
        components, count = ndimage.label(core)
        sizes = np.bincount(components.ravel()); sizes[0] = 0
        largest = int(sizes.max())
        keep = sizes == largest
        keep[0] = False
        mask = keep[components]
        holes, _ = ndimage.label(~mask)
        hole_sizes = np.bincount(holes.ravel())
        small_holes = hole_sizes < 500
        small_holes[0] = False
        mask |= small_holes[holes]
        if not mask.any():
            raise ValueError(f'No illustration found: {name}')
        ys, xs = np.where(mask)
        crop = (slice(ys.min(), ys.max()+1), slice(xs.min(), xs.max()+1))
        data, mask = data[crop], mask[crop]
        rgb = data[:, :, :3].astype(float)
        # Flat color areas, no new geometry. Cream and white remain light across all themes.
        green = (rgb[:, :, 1] - rgb[:, :, 2] > 18) & (rgb[:, :, 1] > rgb[:, :, 0] + 6)
        labels = np.full(mask.shape, 3, dtype=np.uint8)
        labels[green] = 0
        labels = np.array(Image.fromarray(labels).filter(ImageFilter.MedianFilter(15)))
        # Discard small color islands left by generation noise, keeping broad color planes.
        for color in (0, 3):
            regions, _ = ndimage.label((labels == color) & mask)
            areas = np.bincount(regions.ravel()); areas[0] = 0
            small = (areas < max(700, mask.sum() * .025)); small[0] = False
            labels[small[regions]] = 3 if color == 0 else 0
        number = sheet_index * 12 + index + 1
        if number == 26:  # Replace the generated drink's mottling with a single milk layer.
            labels[:] = 0
            labels[int(mask.shape[0] * .57):] = 3
        if number == 30:  # Plain cone, without generated texture.
            labels[:] = 0
            labels[int(mask.shape[0] * .66):] = 3
        if number == 3:  # Keep the envelope flap distinguishable using a large cream plane.
            yy, xx = np.indices(mask.shape)
            labels[yy > (.48 * mask.shape[0] - abs(xx-mask.shape[1]/2)*.3)] = 3
        width, height = mask.shape[1], mask.shape[0]
        side = max(width, height) + 40
        alpha = Image.fromarray((mask * 255).astype('uint8'))
        flat_masks = []
        for theme, colors in PALETTES.items():
            palette = np.array([tuple(bytes.fromhex(h[1:])) for h in colors], dtype=np.uint8)
            rgba = np.dstack([palette[labels], np.array(alpha)])
            rgba[~mask] = 0
            canvas = Image.new('RGBA', (side, side))
            canvas.paste(Image.fromarray(rgba), ((side-width)//2, (side-height)//2))
            canvas = canvas.resize((512,512), Image.Resampling.LANCZOS)
            number = sheet_index * 12 + index + 1
            asset_id = f'theme-20261115-{theme}-{number:02}'
            canvas.save(OUT / f'{asset_id}.png')
            assets.append({'id':asset_id, 'label':f'{THEMES[theme]} {name}', 'src':f'stickers/theme-stationery-20261115/{asset_id}.png', 'theme':theme})
            flat_masks.append(np.array(canvas)[:,:,3])
        assert all(np.array_equal(flat_masks[0], m) for m in flat_masks[1:]), name
        verification.append({'number':number,'name':name,'source':filename,'sourceBox':box,'size':[512,512],'variantAlphaChangedPixels':0})
manifest = {'assets':assets,'palettes':PALETTES,'verification':verification}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
# Review grid, kept outside app assets.
review = ROOT/'output/theme-stationery-20261115'
review.mkdir(parents=True,exist_ok=True)
for theme in THEMES:
    board=Image.new('RGB',(1200,1200),'#eeeeee')
    for i,a in enumerate(x for x in assets if x['theme']==theme):
        im=Image.open(ROOT/'public'/a['src']).resize((190,190),Image.Resampling.LANCZOS)
        board.paste(im,((i%6)*200+5,(i//6)*200+5),im)
    board.save(review/f'{theme}-review.png')
print(f'Created {len(assets)} PNGs; verified identical alpha and dimensions for all 36 × 4 variants.')
