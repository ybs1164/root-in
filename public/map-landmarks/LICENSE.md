# Map landmarks

Source: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
from the local [Geofabrik South Korea extract](https://download.geofabrik.de/asia/south-korea.html).

This derived database is made available under the
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
It contains facility names, representative coordinates and app categories.
It is a snapshot, not a live or exhaustive building directory.

Regenerate with `python scripts/place-kinds/build_landmarks.py` from the project
root. The script requires `osmium` and `shapely` and reads the existing
`data/korea/south-korea.osm.pbf` snapshot.

`index.json` v2 lists `overview` (0.25°) and `detail` (0.1°) tile grids.
Overview tiles contain major facilities and neighborhood institutions; detail
tiles also contain named buildings. Rows are `[OSM id, name, longitude × 1e5,
latitude × 1e5, place kind, category, importance]`. Importance 0/1/2 is visible
at 40/16/4 meters per CSS pixel at the app's fixed reference latitude.

Representative points lie within facility polygons; individual buildings and
campus entrances may have separate coordinates. Unnamed geometry and bare
building numbers are omitted. Existing commercial place data remains separate.
