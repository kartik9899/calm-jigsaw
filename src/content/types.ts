/**
 * Describes a puzzle entry in the content catalogue.
 *
 * Geometry (rows, cols) is NOT stored here — it is derived at play-time from
 * the chosen difficulty using `gridForDifficulty(target, imageAspect)`.
 * This keeps the content layer free of difficulty-specific concerns.
 */
export interface PuzzleContent {
  /**
   * Unique identifier used in routing and save-keys.
   * Must be URL-safe (letters, digits, hyphens only).
   * @example 'sample', 'mountain-lake', 'cityscape-01'
   */
  id: string;

  /** Human-readable title shown in the puzzle selection UI. */
  title: string;

  /**
   * Source for the puzzle photograph.
   * Accepts a Metro `require()` result (number) or a URI string.
   * Passed directly to JigsawCanvas and Skia's `useImage()`.
   */
  imageSource: number | string;

  /**
   * Width-to-height ratio of the source image.
   * Used by `gridForDifficulty` and the puzzle engine.
   * @example 3/2 for a landscape 3000×2000 photo
   */
  imageAspect: number;

  /**
   * Category tag for future grouping in the UI.
   * @example 'nature', 'cityscape', 'abstract'
   */
  category: string;
}
