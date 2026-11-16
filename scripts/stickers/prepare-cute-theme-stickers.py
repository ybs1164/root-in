"""Split three generated 2×5 sheets, then apply four exact app palettes to identical masks.
Usage: python3 scripts/stickers/prepare-cute-theme-stickers.py animals.png daily.png treats.png
"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/stickers/theme-cute-20261116'
REVIEW = ROOT / 'output/theme-cute-20261116'
PALETTES = {
 'matcha':['#a3c46f','#6e9a3c','#dfeac6','#f3f7e9','#ffffff'],
 'banana':['#ffd85f','#fea200','#fce89d','#fff7d8','#ffffff'],
 'strawberry':['#f48fa6','#c94a6a','#fcdbe3','#fff0f3','#ffffff'],
 'choco':['#a8704b','#6f4128','#ecdccf','#f7efe8','#ffffff'],
}
THEMES = dict(matcha='말차',banana='바나나',strawberry='딸기',choco='초코')
NAMES = [
 ['고양이 얼굴','곰 얼굴','토끼 얼굴','강아지 얼굴','판다 얼굴','햄스터 얼굴','여우 얼굴','펭귄','병아리','물범'],
 ['알람시계','스마트폰','휴대용 게임기','카세트테이프','음악 플레이어','배낭','포근한 양말','실내화','찻주전자','꿀단지'],
 ['크루아상','와플','팬케이크','컵케이크','푸딩','막대사탕','포장사탕','티백','팝콘','식빵'],
]
if len(sys.argv)!=4:
 raise SystemExit(__doc__)
OUT.mkdir(parents=True,exist_ok=True)
REVIEW.mkdir(parents=True,exist_ok=True)
assets=[];verification=[]
for group, source in enumerate(map(Path,sys.argv[1:])):
 sheet=Image.open(source).convert('RGBA')
 # Generated rows do not always align to mathematical fifths. Split only in empty gutters.
 occupied=(np.array(sheet)[:,:,3]>=128).sum(axis=1)
 smoothed=np.convolve(occupied,np.ones(5)/5,mode='same')
 row_bounds=[0]
 for boundary in range(1,5):
  ideal=round(boundary*sheet.height/5);radius=round(sheet.height/5*.35)
  lo,hi=max(row_bounds[-1]+20,ideal-radius),min(sheet.height-1,ideal+radius)
  candidates=np.arange(lo,hi+1)
  best=candidates[smoothed[candidates]<=smoothed[candidates].min()+1]
  row_bounds.append(int(best[np.argmin(abs(best-ideal))]))
 row_bounds.append(sheet.height)
 for index,name in enumerate(NAMES[group]):
  col,row=index%2,index//2
  box=(round(col*sheet.width/2),row_bounds[row],round((col+1)*sheet.width/2),row_bounds[row+1])
  data=np.array(sheet.crop(box))
  core=ndimage.binary_opening(data[:,:,3]>=128,iterations=1)
  regions,_=ndimage.label(core)
  sizes=np.bincount(regions.ravel());sizes[0]=0
  keep=sizes==sizes.max();keep[0]=False
  mask=ndimage.binary_closing(keep[regions],iterations=1)
  holes,_=ndimage.label(~mask);areas=np.bincount(holes.ravel())
  small=(areas<16);small[0]=False;mask|=small[holes]
  if not mask.any(): raise ValueError(name)
  yy,xx=np.where(mask);sl=(slice(yy.min(),yy.max()+1),slice(xx.min(),xx.max()+1))
  data,mask=data[sl],mask[sl]
  rgb=data[:,:,:3].astype(float)
  green=(rgb[:,:,1]-rgb[:,:,2]>20)&(rgb[:,:,1]-rgb[:,:,0]>6)
  labels=np.full(mask.shape,3,dtype='uint8');labels[green]=0
  labels[green&(rgb[:,:,1]<174)]=1
  labels=np.array(Image.fromarray(labels).filter(ImageFilter.MedianFilter(3)))
  h,w=mask.shape;side=max(w,h)+max(24,round(max(w,h)*.12))
  alpha=(mask*255).astype('uint8');variant_alphas=[]
  number=group*10+index+1
  if number==17: labels[labels==1]=0
  for theme,colors in PALETTES.items():
   palette=np.array([tuple(bytes.fromhex(c[1:])) for c in colors],dtype='uint8')
   rgba=np.dstack((palette[labels],alpha));rgba[~mask]=0
   image=Image.new('RGBA',(side,side));image.paste(Image.fromarray(rgba),((side-w)//2,(side-h)//2))
   image=image.resize((512,512),Image.Resampling.LANCZOS)
   asset_id=f'theme-20261116-{theme}-{number:02}'
   image.save(OUT/f'{asset_id}.png')
   assets.append(dict(id=asset_id,label=f'{THEMES[theme]} {name}',theme=theme,src=f'stickers/theme-cute-20261116/{asset_id}.png'))
   variant_alphas.append(np.array(image)[:,:,3])
  assert all(np.array_equal(variant_alphas[0],a) for a in variant_alphas[1:]),name
  verification.append(dict(number=number,name=name,source=source.name,sourceBox=box,size=[512,512],variantAlphaChangedPixels=0))
manifest=dict(assets=assets,palettes=PALETTES,verification=verification)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
for theme in THEMES:
 board=Image.new('RGB',(1000,1200),'#efefef')
 for i,a in enumerate(a for a in assets if a['theme']==theme):
  im=Image.open(ROOT/'public'/a['src']).resize((190,190),Image.Resampling.LANCZOS)
  board.paste(im,((i%5)*200+5,(i//5)*200+5),im)
 board.save(REVIEW/f'{theme}-review.png')
print('Created 120 assets; all 30 sets have identical 512×512 dimensions and alpha across four themes.')
