/**
 * Choose the (rows, cols) grid whose total piece count is closest to `count`
 * and whose cell aspect ratio (cellW / cellH) is closest to 1 (square pieces).
 *
 * For a given image of aspect ratio W/H:
 *   cellW / cellH = (W/cols) / (H/rows) = imageAspect × (rows/cols)
 *
 * Setting that equal to 1 gives cols = imageAspect × rows, which is what we
 * optimise toward: more columns than rows for wide images, more rows for tall.
 *
 * Score = countError × 5 + aspectError   (count error dominates; aspect breaks ties)
 */
export function gridForDifficulty(
  count: number,
  imageAspect: number,
): { rows: number; cols: number } {
  let bestRows = 1;
  let bestCols = count;
  let bestScore = Infinity;

  // Iterate over all plausible row values.
  // Upper bound: if cols≥1 and total≈count, then rows ≤ count.
  // In practice rows ≤ sqrt(count/imageAspect)*3 covers all reasonable cases.
  const maxRows = Math.min(
    count,
    Math.ceil(Math.sqrt(count / Math.max(imageAspect, 0.01)) * 3) + 2,
  );

  for (let rows = 1; rows <= maxRows; rows++) {
    // The ideal cols for square cells given this row count
    const colsTarget = rows * imageAspect;
    // Consider floor and ceil to bracket the ideal
    const candidates: number[] = [Math.max(1, Math.floor(colsTarget)), Math.ceil(colsTarget)];

    for (const cols of candidates) {
      if (cols < 1) continue;
      const total = rows * cols;

      const countError = Math.abs(total - count) / count;
      if (countError > 0.6) continue; // skip wildly wrong totals

      // cellAspect = imageAspect * rows / cols; want ≈ 1
      const cellAspect = (imageAspect * rows) / cols;
      const aspectError = Math.abs(cellAspect - 1);

      const score = countError * 5 + aspectError;
      if (score < bestScore) {
        bestScore = score;
        bestRows = rows;
        bestCols = cols;
      }
    }
  }

  return { rows: bestRows, cols: bestCols };
}
