import { PIN_ICONS, type PinIcon } from '../types/pin';

/** Original twelve-icon order: 12, 1, 2, 4, 9. */
export const QUICK_PIN_ICONS: readonly PinIcon[] = ['pin', 'cafe', 'food', 'photo', 'star'];
export const PIN_ICON_GROUPS: { id: string; label: string; icons: PinIcon[] }[] = [
  { id: 'shapes', label: '도형', icons: ['pin', 'circle', 'square', 'diamond', 'star', 'heart', 'flag', 'check', 'cross', 'quote'] },
  { id: 'sports', label: '스포츠·레저', icons: ['ball', 'basketball', 'football', 'tennis', 'badminton', 'bowling', 'golf', 'bike', 'hiking', 'dumbbell', 'swim', 'tent'] },
  { id: 'places', label: '장소', icons: ['cafe', 'food', 'bar', 'photo', 'shop', 'stay', 'culture', 'burger', 'pizza', 'cake', 'bread', 'icecream', 'sushi', 'beer', 'cocktail', 'book', 'music', 'theater', 'hospital', 'gift', 'flower', 'building', 'church', 'school', 'bank', 'parking', 'wifi'] },
  { id: 'transport', label: '교통수단', icons: ['car', 'bus', 'train', 'plane', 'ship', 'scooter', 'rocket'] },
  { id: 'weather', label: '날씨', icons: ['sun', 'moon', 'cloud', 'rain', 'snow', 'lightning', 'umbrella'] },
  { id: 'animals', label: '동물', icons: ['dog', 'cat', 'fish', 'bird', 'rabbit', 'paw'] },
  { id: 'nature', label: '자연', icons: ['nature', 'mountain', 'palm', 'waterfall', 'tree', 'leaf'] },
];

export function filterCategoryIcons(query: string, group = 'all') {
  const term = query.trim().toLocaleLowerCase();
  return PIN_ICON_GROUPS.filter((g) => group === 'all' || g.id === group)
    .map((g) => ({ ...g, icons: g.icons.filter((icon) => !term || `${PIN_ICONS[icon]} ${icon}`.toLocaleLowerCase().includes(term)) }))
    .filter((g) => g.icons.length > 0);
}
