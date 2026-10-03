// Small markup helpers shared by the theme files.
export const D = (x, y, inner, style = '') => `<div class="deco" style="left:${x}px;top:${y}px;${style}">${inner}</div>`;
export const star = (c, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 1.5l2.9 7 7.6.6-5.8 4.9 1.8 7.4L12 17.4 5.5 21.4l1.8-7.4L1.5 9.1l7.6-.6z" fill="${c}"/></svg>`;
export const spark = (c, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0z" fill="${c}"/></svg>`;
export const heart = (c, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8C20 15.8 12 21 12 21z" fill="${c}"/></svg>`;
export const rot = (d) => `transform:rotate(${d}deg);`;
