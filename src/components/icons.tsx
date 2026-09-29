import { Star } from 'lucide-react';

// Icons are Lucide (ISC). Import them per icon from 'lucide-react' so only
// the ones in use end up in the bundle.

/** Wishlist star: outline when off, filled when on. */
export function WishStar({ on, size = 22 }: { on: boolean; size?: number }) {
  return <Star size={size} fill={on ? 'currentColor' : 'none'} aria-hidden />;
}
