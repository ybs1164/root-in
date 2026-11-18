import type { StickerSheet } from '../domain/stickerSheets';

/** The pack's band: its colour (set on the sheet), its name, a pattern and a STICKER PACK tag. */
export default function StickerPackBand({ sheet }: { sheet: Pick<StickerSheet, 'name' | 'nameStyle' | 'motif'> }) {
  return (
    <div className="sticker-pack__band" aria-hidden>
      <span className={`sticker-pack__name sticker-pack__name--${sheet.nameStyle}`}>{sheet.name}</span>
      <span className="sticker-pack__side">
        {sheet.motif !== 'none' && <i className={`sticker-pack__motif sticker-pack__motif--${sheet.motif}`} />}
        <span className="sticker-pack__tag">STICKER PACK</span>
      </span>
    </div>
  );
}
