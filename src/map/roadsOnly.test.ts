import { describe, expect, it } from 'vitest';
import { isRoadsOnlyLayer } from './roadsOnly';

describe('roads-only basemap', () => {
  it('keeps roads, rail, water and road names', () => {
    for (const id of [
      'background',
      'water',
      'water_shadow',
      'waterway',
      'road_minor_fill',
      'road_mot_case_noramp',
      'tunnel_pri_fill',
      'bridge_path',
      'rail',
      'rail_dash',
      'tunnel_rail',
      'roadname_minor',
      'roadname_major',
    ]) {
      expect(isRoadsOnlyLayer(id), id).toBe(true);
    }
  });

  it('hides places, POIs, buildings and land use', () => {
    for (const id of [
      'poi_park',
      'poi_stadium',
      'place_suburbs',
      'place_city_r6',
      'housenumber',
      'building',
      'building-top',
      'landuse',
      'landcover',
      'park_national_park',
      'watername_lake',
      'waterway_label',
      'boundary_county',
      'aeroway-runway',
      'something_new',
    ]) {
      expect(isRoadsOnlyLayer(id), id).toBe(false);
    }
  });
});
