import type { GeneratedPuzzle, GroupState, PieceSpec } from '../core/types';

/**
 * Scatter all pieces randomly in a region 1.5× the image size on each side.
 *
 * Returns a fresh groups Record — one entry per piece, each in its own group.
 * Use this as the initial `SolveState.groups` for a new game.
 *
 * piece.worldPos = piece.correctPos + translation
 * Scatter places worldPos randomly in [-padX, imageW+padX] × [-padY, imageH+padY].
 */
export function scatterGroups(
  pieces: PieceSpec[],
  puzzle: Pick<GeneratedPuzzle, 'imageAspect'>,
  prng: () => number,
): Record<number, GroupState> {
  const imageW = 1000;
  const imageH = 1000 / puzzle.imageAspect;

  // 1.5× image padding on each side gives a 4× total scatter area
  const padX = imageW * 0.75;
  const padY = imageH * 0.75;
  const areaW = imageW + 2 * padX;
  const areaH = imageH + 2 * padY;

  const groups: Record<number, GroupState> = {};

  for (const piece of pieces) {
    const wx = -padX + prng() * areaW;
    const wy = -padY + prng() * areaH;
    groups[piece.index] = {
      root: piece.index,
      translation: { x: wx - piece.correctPos.x, y: wy - piece.correctPos.y },
      rotationRad: 0,
    };
  }

  return groups;
}
