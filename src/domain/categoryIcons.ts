import type { PinIcon } from '../types/pin';

/** Original twelve-icon order: 12, 1, 2, 4, 9. */
export const QUICK_PIN_ICONS: readonly PinIcon[] = ['pin', 'cafe', 'food', 'photo', 'star'];
export const PIN_ICON_GROUPS: { id: string; label: string; icons: PinIcon[] }[] = [
  { id: 'shapes', label: '도형', icons: ['pin', 'circle', 'square', 'diamond', 'star', 'heart', 'flag', 'check', 'cross', 'quote'] },
  { id: 'places', label: '장소', icons: ['photo', 'shop', 'stay', 'culture', 'book', 'music', 'theater', 'hospital', 'gift', 'building', 'church', 'school', 'bank', 'parking', 'wifi'] },
  { id: 'food', label: '음식', icons: ['cafe', 'food', 'bar', 'burger', 'pizza', 'cake', 'bread', 'icecream', 'sushi', 'beer', 'cocktail'] },
  { id: 'nature', label: '자연', icons: ['nature', 'flower', 'mountain', 'palm', 'tree', 'leaf'] },
  { id: 'transport', label: '교통수단', icons: ['car', 'bus', 'train', 'plane', 'ship', 'scooter', 'rocket'] },
  { id: 'sports', label: '스포츠레저', icons: ['ball', 'basketball', 'football', 'tennis', 'badminton', 'bowling', 'golf', 'bike', 'hiking', 'dumbbell', 'swim', 'tent'] },
  { id: 'weather', label: '날씨', icons: ['sun', 'moon', 'cloud', 'rain', 'snow', 'lightning', 'umbrella'] },
  { id: 'animals', label: '동물', icons: ['dog', 'cat', 'fish', 'bird', 'rabbit', 'paw'] },
];
