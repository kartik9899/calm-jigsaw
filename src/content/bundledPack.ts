/**
 * Built-in puzzle catalogue.
 *
 * These puzzles are bundled with the app binary and available offline.
 * Add new entries here as additional puzzle images land in assets/puzzles/.
 *
 * Each entry's `id` must be unique and URL-safe — it is used as the route
 * param in `app/puzzle/[id].tsx` and as part of MMKV save-keys.
 */

import type { PuzzleContent } from './types';

export const BUNDLED_PUZZLES: PuzzleContent[] = [
  {
    id: 'sample',
    title: 'Mountain Lake',
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    imageSource: require('../../assets/puzzles/sample.png') as number,
    imageAspect: 3 / 2,
    category: 'nature',
  },
];
