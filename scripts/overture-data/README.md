# Overture Buildings data (for the four demo places)

The app ships small, pre-extracted building extracts under
[`public/overture/`](../../public/overture) — one GeoJSON file per demo place
(`seoul.geojson`, `busan.geojson`, `tokyo.geojson`, `singapore.geojson`),
sourced from [Overture Maps Foundation](https://docs.overturemaps.org/)'s
open Buildings theme. These are fetched at runtime when the "Buildings
(Overture)" layer is turned on for a place.

Overture's official data lives in public S3 GeoParquet, partitioned so a
bbox query only reads the relevant row groups — no API key needed. There is
**no supported way to query it live from the browser** (DuckDB-WASM doesn't
support `httpfs` against arbitrary S3, and Overture's bucket has no CORS
policy for browser fetches), so extracts are pre-generated offline with the
official Python CLI and bundled as static assets instead.

## Regenerating

```bash
pip install overturemaps

overturemaps download --bbox=<west,south,east,north> \
  -o <city>-buildings.geojson -f geojson -t building

python trim.py <city>-buildings.geojson ../../public/overture/<city>.geojson
```

`trim.py` strips fields the app doesn't use (`sources`, `has_parts`,
`is_underground`, `level`, `version`), flattens `names.primary` to a plain
`name` string, and rounds coordinates to 6 decimal places — this cut the
Tokyo extract from 5.6 MB to 2.2 MB. Kept properties: `name`, `class`,
`subtype`, `height`, `num_floors`.

Bounding boxes used (center ± ~0.0125° lon / ~0.0075° lat around each
place's `center` in [src/App.tsx](../../src/App.tsx)):

| Place | bbox (west,south,east,north) |
|---|---|
| Seoul | 126.965,37.560,126.990,37.575 |
| Busan | 129.0631,35.1721,129.0881,35.1871 |
| Tokyo | 139.6792,35.6820,139.7042,35.6970 |
| Singapore | 103.8073,1.3446,103.8323,1.3596 |

Coverage is real-world OSM-derived, so most buildings are missing one or
more of `height`/`num_floors`/`class`/`name` (Seoul extract: ~19% have
`class`, ~15% `name`, ~16% `num_floors`, ~9% `height`) — still substantially
more structured than raw Overpass/OSM tags, but expect gaps in the UI.
