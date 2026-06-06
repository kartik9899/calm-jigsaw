import { Skia } from '@shopify/react-native-skia';
import type { SkPath } from '@shopify/react-native-skia';

import type { PathCmd } from '../core/types';

/**
 * Convert a PathCmd array (pure data from src/core) into a live SkPath.
 *
 * Called at render time — do NOT call inside a worklet (SkPath is a JS-thread object).
 */
export function pathFromCmds(cmds: PathCmd[]): SkPath {
  const path = Skia.Path.Make();
  for (const c of cmds) {
    switch (c.cmd) {
      case 'moveTo':
        path.moveTo(c.x, c.y);
        break;
      case 'lineTo':
        path.lineTo(c.x, c.y);
        break;
      case 'cubicTo':
        path.cubicTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
        break;
      case 'close':
        path.close();
        break;
    }
  }
  return path;
}
