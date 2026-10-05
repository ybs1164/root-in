/**
 * The "FROM → TO" line on a pin's ticket: the city and the neighbourhood of
 * the place's saved address, in English (Revised Romanization). Read-only and
 * best-effort — a road address names no 동, so it falls back to the 구.
 */

const ONSETS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const VOWELS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
/** Each final (jongseong index 1–27) as [its own sound, what it carries over before a silent ㅇ]. */
const FINALS: [string, string][] = [
  ['', ''],
  ['k', 'g'], ['k', 'kk'], ['k', 's'], ['n', 'n'], ['n', 'j'], ['n', ''], ['t', 'd'], ['l', 'r'],
  ['l', 'g'], ['l', 'm'], ['l', 'b'], ['l', 's'], ['l', 't'], ['l', 'p'], ['l', ''], ['m', 'm'],
  ['p', 'b'], ['p', 's'], ['t', 's'], ['t', 'ss'], ['ng', ''], ['t', 'j'], ['t', 'ch'], ['k', 'k'],
  ['t', 't'], ['p', 'p'], ['t', ''],
];
const ONSET_SILENT = 11;
const ONSET_N = 2;
const ONSET_R = 5;
const ONSET_M = 6;
const FINAL_NG = 21;

const isSyllable = (ch: string) => ch >= '가' && ch <= '힣';

/** Romanizes Hangul with the common sound changes place names need (종로 → jongno, 신림 → sillim). */
export function romanize(text: string): string {
  const chars = [...text];
  let out = '';
  // An onset already decided by the previous syllable's final (liaison, assimilation).
  let carried: string | null = null;
  chars.forEach((ch, i) => {
    if (!isSyllable(ch)) {
      out += ch;
      carried = null;
      return;
    }
    const code = ch.charCodeAt(0) - 0xac00;
    const onset = Math.floor(code / 588);
    const vowel = Math.floor((code % 588) / 28);
    const final = code % 28;
    out += (carried ?? (i === 0 && onset === ONSET_R ? 'r' : ONSETS[onset])) + VOWELS[vowel];
    carried = null;

    if (!final) return;
    const next = chars[i + 1];
    const nextOnset = next && isSyllable(next) ? Math.floor((next.charCodeAt(0) - 0xac00) / 588) : -1;
    const [coda, over] = FINALS[final];
    if (nextOnset === ONSET_SILENT && final !== FINAL_NG) {
      // Liaison: the final moves to start the next syllable (ㄹ's coda stays for a double final).
      if (coda === 'l' && over !== 'r') out += 'l';
      else if (coda === 'n' && over !== 'n') out += 'n';
      carried = over;
    } else if (coda === 'l' && nextOnset === ONSET_N) {
      // ㄹ + ㄴ → ll.
      out += 'l';
      carried = 'l';
    } else if (nextOnset === ONSET_N || nextOnset === ONSET_M) {
      // Nasalization: k/t/p before ㄴ ㅁ.
      out += coda === 'k' ? 'ng' : coda === 't' ? 'n' : coda === 'p' ? 'm' : coda;
    } else if (nextOnset === ONSET_R) {
      if (coda === 'n' || coda === 'l') {
        out += 'l';
        carried = 'l';
      } else {
        out += coda === 'k' ? 'ng' : coda === 'p' ? 'm' : coda === 't' ? 'n' : coda;
        carried = 'n';
      }
    } else {
      out += coda;
    }
  });
  return out;
}

/** 시·도 written out in full → the short name everyone uses. */
const PROVINCES: Record<string, string> = {
  경기도: '경기', 강원도: '강원', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남',
  전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남',
  제주특별자치도: '제주', 제주도: '제주',
};

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const HANGUL = /[가-힣]/;

export interface AddressRoute {
  from: string;
  to?: string;
}

/** '서울 성동구 성수동1가 685' → { from: 'Seoul', to: 'Seongsu' }; null when nothing usable. */
export function addressRoute(address: string | undefined): AddressRoute | null {
  const tokens = (address ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  if (!HANGUL.test(address ?? '')) {
    // Already romanized (Photon): "Seoul Seongdong-gu Achasan-ro 9-gil".
    const from = tokens[0].replace(/,$/, '');
    const area = tokens.find((t) => /-dong$/i.test(t)) ?? tokens.slice(1).find((t) => /-(gu|gun|si)$/i.test(t));
    const to = area?.replace(/-(dong|gu|gun|si)$/i, '');
    return { from: capitalize(from), ...(to ? { to: capitalize(to) } : {}) };
  }

  const city = PROVINCES[tokens[0]] ?? tokens[0].replace(/(특별자치시|특별자치도|특별시|광역시)$/, '');
  if (!HANGUL.test(city)) return null;
  const rest = tokens.slice(1);
  // A 동·읍·면 first (성수동1가 → 성수, 신당5동 → 신당), else the most specific 시·군·구.
  const dong = rest.map((t) => /^([가-힣]+?)\d*(동|읍|면)(\d+가)?$/.exec(t)?.[1]).find(Boolean);
  const district = [...rest].reverse().map((t) => /^([가-힣]+)(구|군|시)$/.exec(t)?.[1]).find(Boolean);
  const area = dong ?? district;
  return {
    from: capitalize(romanize(city)),
    ...(area && area !== city ? { to: capitalize(romanize(area)) } : {}),
  };
}

/**
 * The neighbourhood of a Korean address in Korean (성수동1가 → 성수), else its
 * most specific 시·군·구: what the 노트 card writes by hand after the date.
 */
export function addressArea(address: string | undefined): string | null {
  const tokens = (address ?? '').trim().split(/\s+/).filter(Boolean).slice(1);
  const dong = tokens.map((t) => /^([가-힣]+?)\d*(동|읍|면)(\d+가)?$/.exec(t)?.[1]).find(Boolean);
  const district = [...tokens].reverse().map((t) => /^([가-힣]+)(구|군|시)$/.exec(t)?.[1]).find(Boolean);
  return dong ?? district ?? null;
}
