export type Place = {
  id: string;
  name: string;
  note: string;
  center: [number, number];
  zoom: number;
};

// Single source of truth for the known places. Both the map (App.tsx) and
// the travel-route feature (services/hooks/components) read from here so
// a place is defined once and referenced everywhere by id.
export const places: Place[] = [
  { id: 'seoul', name: 'Seoul', note: 'default focus', center: [126.978, 37.5665], zoom: 11.5 },
  { id: 'busan', name: 'Busan', note: 'coastal hub', center: [129.0756, 35.1796], zoom: 11.2 },
  { id: 'tokyo', name: 'Tokyo', note: 'dense city grid', center: [139.6917, 35.6895], zoom: 10.8 },
  { id: 'singapore', name: 'Singapore', note: 'tropical transit node', center: [103.8198, 1.3521], zoom: 11.4 },
];

export const findPlace = (id: string | null | undefined): Place | undefined =>
  id ? places.find((place) => place.id === id) : undefined;
