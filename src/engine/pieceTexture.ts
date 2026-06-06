import { ClipOp, Skia } from '@shopify/react-native-skia';
import type { SkImage } from '@shopify/react-native-skia';

import type { GeneratedPuzzle, PieceSpec } from '../core/types';
import { pathFromCmds } from './pathFromCmds';

type PuzzleDims = Pick<GeneratedPuzzle, 'cellW' | 'cellH' | 'tabOverhang' | 'imageAspect'>;

/**
 * Rasterize one jigsaw piece into an offscreen SkImage texture.
 *
 * The texture is sized to cover the cell PLUS tabOverhang on all four sides so
 * that tab protrusions are never clipped. Render the returned image at world
 * position (correctPos.x − tabOverhang, correctPos.y − tabOverhang).
 *
 * Returns null if the Skia surface could not be created (out of memory, etc.).
 *
 * Called on the JS thread — do NOT call inside a worklet.
 */
export function rasterizePiece(
  piece: PieceSpec,
  puzzle: PuzzleDims,
  image: SkImage,
): SkImage | null {
  const { cellW, cellH, tabOverhang, imageAspect } = puzzle;
  const { correctPos } = piece;

  const imageWorldH = 1000 / imageAspect;

  // Scale factor: world units → source image pixels
  const scaleX = image.width() / 1000;
  const scaleY = image.height() / imageWorldH;

  // Surface pixel dimensions (include overhang on all four sides)
  const surfW = Math.ceil((cellW + 2 * tabOverhang) * scaleX);
  const surfH = Math.ceil((cellH + 2 * tabOverhang) * scaleY);

  const surface = Skia.Surface.Make(surfW, surfH);
  if (!surface) return null;

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));

  canvas.save();

  // After scale: 1 canvas unit = 1 world unit rendered at image resolution.
  // After translate: canvas origin = piece-local (0,0) = cell top-left corner.
  // So piece-local coord (px, py) → surface pixel ((px + tabOverhang)*scaleX, ...).
  canvas.scale(scaleX, scaleY);
  canvas.translate(tabOverhang, tabOverhang);

  // Clip to the piece outline (piece-local coordinates)
  const clipPath = pathFromCmds(piece.pathCommands);
  canvas.clipPath(clipPath, ClipOp.Intersect, true);

  // Draw the full puzzle image. In piece-local coords, world (0,0) is at
  // (-correctPos.x, -correctPos.y), so the image is placed there.
  const paint = Skia.Paint();
  canvas.drawImageRect(
    image,
    { x: 0, y: 0, width: image.width(), height: image.height() },
    { x: -correctPos.x, y: -correctPos.y, width: 1000, height: imageWorldH },
    paint,
  );

  canvas.restore();

  return surface.makeImageSnapshot();
}

/**
 * Rasterize all pieces in async chunks to avoid blocking the JS thread.
 *
 * `chunkSize` pieces are rasterized synchronously per tick; `setTimeout(0)`
 * between chunks yields to allow React to process frames.
 *
 * @param onProgress  Optional callback called after each chunk (done, total).
 */
export async function rasterizeAll(
  pieces: PieceSpec[],
  puzzle: PuzzleDims,
  image: SkImage,
  chunkSize = 8,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<number, SkImage>> {
  const textures = new Map<number, SkImage>();

  for (let i = 0; i < pieces.length; i += chunkSize) {
    const chunk = pieces.slice(i, i + chunkSize);
    for (const piece of chunk) {
      const tex = rasterizePiece(piece, puzzle, image);
      if (tex) textures.set(piece.index, tex);
    }
    const done = Math.min(i + chunkSize, pieces.length);
    onProgress?.(done, pieces.length);
    // Yield to keep the JS thread responsive between chunks
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return textures;
}
