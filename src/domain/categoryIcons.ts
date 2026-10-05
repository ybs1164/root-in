import type { PinIcon } from '../types/pin';

/** Original twelve-icon order: 12, 1, 2, 4, 9. */
export const QUICK_PIN_ICONS: readonly PinIcon[] = ['pin', 'cafe', 'food', 'photo', 'star'];
/** `en` is the spaced-caps heading the icon picker shows; `label` is read out. */
export const PIN_ICON_GROUPS: { id: string; label: string; en: string; icons: PinIcon[] }[] = [
  { id: 'shapes', en: 'SHAPES', label: '도형', icons: ['pin', 'circle', 'square', 'diamond', 'star', 'heart', 'flag', 'check', 'cross', 'quote'] },
  { id: 'places', en: 'PLACES', label: '장소', icons: ['photo', 'shop', 'stay', 'book', 'music', 'theater', 'hospital', 'gift', 'building', 'church', 'school', 'bank', 'parking', 'wifi', 'cinema', 'amusement', 'salon', 'laundry', 'store', 'gas', 'restroom', 'post'] },
  { id: 'food', en: 'FOOD', label: '음식', icons: ['cafe', 'food', 'bar', 'burger', 'pizza', 'cake', 'bread', 'icecream', 'sushi', 'beer', 'cocktail', 'donut', 'chicken', 'noodles', 'sandwich', 'apple', 'cheese', 'tea', 'drink'] },
  { id: 'nature', en: 'NATURE', label: '자연', icons: ['nature', 'flower', 'mountain', 'palm', 'tree', 'leaf'] },
  { id: 'transport', en: 'TRANSPORT', label: '교통수단', icons: ['car', 'bus', 'train', 'plane', 'ship', 'scooter', 'rocket'] },
  { id: 'sports', en: 'SPORTS', label: '스포츠레저', icons: ['ball', 'basketball', 'football', 'tennis', 'badminton', 'bowling', 'golf', 'bike', 'hiking', 'dumbbell', 'swim', 'tent'] },
  { id: 'weather', en: 'WEATHER', label: '날씨', icons: ['sun', 'moon', 'cloud', 'rain', 'snow', 'lightning', 'umbrella'] },
  { id: 'animals', en: 'ANIMALS', label: '동물', icons: ['dog', 'cat', 'fish', 'bird', 'rabbit', 'paw'] },
];
