import { EdgeSpec, PathCmd } from '../types';

/**
 * Convert one edge of a jigsaw piece into a sequence of PathCmd data.
 *
 * The path always begins at `start` (the caller already issued a moveTo or
 * the previous edge ended there).  The sequence ends AT `end` — the caller
 * chains multiple edges to close the piece path.
 *
 * Flat edge  → single lineTo.
 * Knob/blank → lineTo tab-start, two cubicTo curves (ramp up / ramp down),
 *              lineTo edge-end.  A knob bulges toward `outNormal`; a blank
 *              dips away from it.
 *
 * All output is plain serialisable data — no Skia imports whatsoever.
 *
 * @param start       World-space start of this edge.
 * @param end         World-space end of this edge.
 * @param outNormal   Unit vector pointing AWAY from the piece centre (outward).
 * @param spec        Edge specification (type, jitter, size).
 * @param cellMinDim  min(cellW, cellH) — used to scale tab height.
 */
export function edgePathCmds(
  start: { x: number; y: number },
  end: { x: number; y: number },
  outNormal: { x: number; y: number },
  spec: EdgeSpec,
  cellMinDim: number,
): PathCmd[] {
  if (spec.type === 'flat') {
    return [{ cmd: 'lineTo', x: end.x, y: end.y }];
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Unit along-edge vector
  const ux = dx / len;
  const uy = dy / len;

  const nx = outNormal.x;
  const ny = outNormal.y;

  // Tab height: positive = outward (knob), negative = inward (blank)
  const sign = spec.type === 'knob' ? 1 : -1;
  const h = sign * spec.size * cellMinDim;

  // Tab centre parameterised along the edge (0 = start, 1 = end).
  // jitter shifts it ±15 % of edge length from the midpoint.
  const tc = 0.5 + spec.jitter * 0.15;

  // Half-width of the tab "neck" region along the edge
  const hw = 0.17 * len;

  // ── Key points ───────────────────────────────────────────────────────────

  // Tab shoulder points (on the baseline)
  const tsx = start.x + (tc - hw) * len * ux;
  const tsy = start.y + (tc - hw) * len * uy;
  const tex = start.x + (tc + hw) * len * ux;
  const tey = start.y + (tc + hw) * len * uy;

  // Tab head (peak / valley)
  const ttx = start.x + tc * len * ux + h * nx;
  const tty = start.y + tc * len * uy + h * ny;

  // ── Bezier control points ─────────────────────────────────────────────────

  // Left ramp  Ts → Tt
  const cp1x = tsx + h * 0.5 * nx; // start curving outward
  const cp1y = tsy + h * 0.5 * ny;
  const cp2x = ttx - hw * len * 0.5 * ux; // approach head from the left
  const cp2y = tty - hw * len * 0.5 * uy;

  // Right ramp  Tt → Te
  const cp3x = ttx + hw * len * 0.5 * ux; // leave head to the right
  const cp3y = tty + hw * len * 0.5 * uy;
  const cp4x = tex + h * 0.5 * nx; // curve back to baseline
  const cp4y = tey + h * 0.5 * ny;

  return [
    { cmd: 'lineTo', x: tsx, y: tsy },
    { cmd: 'cubicTo', x1: cp1x, y1: cp1y, x2: cp2x, y2: cp2y, x: ttx, y: tty },
    { cmd: 'cubicTo', x1: cp3x, y1: cp3y, x2: cp4x, y2: cp4y, x: tex, y: tey },
    { cmd: 'lineTo', x: end.x, y: end.y },
  ];
}
