// Packs the Korea map data the app reads into a standalone, versioned folder
// (docs/plan-data-hosting.md H2) that any app can load over HTTP: root-in via
// VITE_MAP_DATA_URL, other apps by reading the same files (format in the
// README.md written next to them).
//
//   node scripts/publish-map-data.mjs                 → data/map-data/korea-<YYYYMMDD>/ (gzipped)
//   node scripts/publish-map-data.mjs --raw           plain JSON → data/map-data/raw/korea-<YYYYMMDD>/, for hosts that
//                                                     compress by themselves (GitHub Pages) or bundling into another app
//   node scripts/publish-map-data.mjs --version korea-20261022 --out <folder> --src public/korea
//
// Only the folders the app still reads go in — not the old flat layout
// (korea/detail…, ~3GB) nor the road-cut admin files (section/, block/, walk/,
// road/) dropped in docs/plan-mainmap-style.md M9.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const FORMAT = 1;
const INCLUDED = [
  'LICENSE.md',
  'base/manifest.json', 'base/detail', 'base/city', 'base/region', 'base/country',
  'admin/sido.json', 'admin/sgg', 'admin/dong',
  'places',
];

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
// Local date: in Korea the UTC date is a day behind before 9am.
const now = new Date();
const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const src = option('--src', 'public/korea');
const version = option('--version', `korea-${today}`);
const raw = args.includes('--raw');
// The folder keeps the version name either way: it is what the URL ends in.
const out = join(option('--out', raw ? 'data/map-data/raw' : 'data/map-data'), version);

if (!/^[a-z0-9][a-z0-9._-]*$/.test(version)) throw new Error(`Version must be a URL-safe folder name: ${version}`);
const missing = INCLUDED.filter((p) => !existsSync(join(src, p)));
if (missing.length) {
  throw new Error(`Missing in ${src}: ${missing.join(', ')} — build them first (scripts/korea-data/README.md, scripts/place-kinds/README.md).`);
}

const walk = (path) => statSync(path).isDirectory()
  ? readdirSync(path).sort().flatMap((name) => walk(join(path, name)))
  : [path];
const sources = INCLUDED.flatMap((p) => walk(join(src, p)));

// A fresh folder: a stale file from an older run must not end up uploaded.
rmSync(out, { recursive: true, force: true });
const files = [];
let bytes = 0, stored = 0;
for (const [i, file] of sources.entries()) {
  const path = relative(src, file).split(sep).join('/');
  const body = readFileSync(file);
  const data = raw ? body : gzipSync(body, { level: 9 });
  const target = join(out, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  files.push({ path, bytes: body.length, stored: data.length, sha256: createHash('sha256').update(body).digest('hex') });
  bytes += body.length;
  stored += data.length;
  if ((i + 1) % 1000 === 0) console.log(`  ${i + 1}/${sources.length}`);
}

const mb = (n) => `${(n / 1e6).toFixed(1)}MB`;
const count = (prefix) => files.filter((f) => f.path.startsWith(prefix)).length;
// The index another app reads first; never gzipped so it can be fetched with no setup.
writeFileSync(join(out, 'files.json'), `${JSON.stringify({
  format: FORMAT,
  version,
  created: new Date().toISOString(),
  encoding: raw ? 'identity' : 'gzip',
  bytes,
  stored,
  files,
}, null, 0)}\n`);
writeFileSync(join(out, 'README.md'), readme({ version, raw, files: files.length, bytes, stored, count }));

console.log(`${files.length} files, ${mb(bytes)} → ${mb(stored)}${raw ? '' : ' gzipped'} in ${out}`);

function readme({ version, raw, files, bytes, stored, count }) {
  return `# 대한민국 지도 데이터 \`${version}\`

root-in이 그리는 땅·행정구역·장소 종류 데이터를 앱과 따로 묶은 것. 어느 앱이든 이 폴더를
HTTP로 올려 두고 같은 파일을 읽으면 된다. 만든 곳: root-in \`scripts/publish-map-data.mjs\`.
라이선스: 같은 폴더 \`LICENSE.md\`(OpenStreetMap ODbL, 행정경계 출처) — 이 데이터를 쓰는 앱은 출처를 표시해야 한다.

- 파일 ${files}개, 원본 ${(bytes / 1e6).toFixed(1)}MB${raw ? '' : `, gzip ${(stored / 1e6).toFixed(1)}MB`}
- ${raw
    ? '압축하지 않은 JSON. 앱에 그대로 넣어(번들) 읽어도 된다.'
    : '모든 파일(`files.json`·`README.md` 제외)은 이름은 `.json` 그대로, 내용은 **gzip**. 올릴 때 `Content-Encoding: gzip`, `Content-Type: application/json` 헤더를 붙여야 브라우저·HTTP 클라이언트가 알아서 푼다. 앱에 직접 넣으려면 `--raw`로 다시 만든다.'}
- 버전 폴더는 바뀌지 않는다(\`Cache-Control: public, max-age=31536000, immutable\`). 데이터를 다시 만들면 새 버전 폴더로 올리고 옛 폴더는 남겨 둔다 — 이미 설치된 앱이 옛 주소를 읽는다.
- 다른 출처의 웹·WebView 앱이 읽으려면 서버가 CORS로 그 출처를 허용해야 한다(Capacitor 안드로이드는 \`https://localhost\`).

## files.json

\`{ format: ${FORMAT}, version, created, encoding: "gzip"|"identity", bytes, stored, files: [{ path, bytes, stored, sha256 }] }\` —
\`bytes\`·\`sha256\`은 압축 전 원본 기준. 올릴 때 바뀐 파일만 고르거나, 받은 파일을 검증하는 데 쓴다.

## 좌표

모두 WGS84 경도·위도(\`[lon, lat]\`). 다각형은 \`PolygonRings\` = 링 배열(첫 링이 바깥, 나머지는 구멍), 링은 닫힌 점 배열(4점 이상).

## base/ — 땅(바다와 땅의 경계) 타일 (${count('base/')}개)

- \`base/manifest.json\`: \`{ version: 1, levels: [{ name, step, maxTier, tiles: ["x_y", …] }] }\`, 단계는 차례로
  \`detail\`(0.05°) · \`city\`(0.2°) · \`region\`(1°) · \`country\`(4°). \`tiles\`에 있는 칸만 파일이 있다.
- \`base/<단계>/<x>_<y>.json\`: 경도 \`x*step\`~\`(x+1)*step\`, 위도 \`y*step\`~\`(y+1)*step\` 칸.
  \`{ land: PolygonRings[], parks: PolygonRings[], roads: [[tier, [lon0, lat0, lon1, lat1, …]], …] }\`.
- 고르는 법(root-in): 화면 1px이 몇 m인지로 단계를 고르고, 화면을 덮는 칸이 48개를 넘으면 한 단계 위로 (\`src/services/koreaMapService.ts\`).

## admin/ — 행정구역 (${count('admin/')}개)

- \`admin/sido.json\`: \`{ version: 1, areas: Area[] }\` — 시도 전부.
- \`admin/sgg/<시도코드>.json\`: 그 시도의 시군구 \`Area[]\`.
- \`admin/dong/<시군구코드>.json\`: 그 시군구의 읍면동 \`Area[]\`.
- \`Area = { code, name, bbox: [west, south, east, north], rings: PolygonRings[] }\`. 코드는 행정동 코드(시도 2자리 ⊂ 시군구 5자리 ⊂ 읍면동 10자리).
- 화면에 필요한 부모 파일만 받으면 된다: \`sido.json\` → 화면에 걸친 시도의 \`sgg/\` → 가운데 시군구의 \`dong/\`.

## places/ — 장소 종류 (${count('places/')}개)

- \`places/<시군구코드>.json\`: \`{ v: 1, k: ["cafe", …], r: [[이름, 경도×1e5, 위도×1e5, k 번호], …] }\` — 소상공인 상가정보에서 이름·좌표·종류만(주소·전화 없음).
  어떤 지점의 장소 종류를 찾을 때 그 지점의 시군구(\`admin/\`) 파일 하나만 받는다. \`places/index.json\`은 시군구별 행 수.
`;
}
