/**
 * @param {{
 *   x: number,
 *   y: number,
 *   width: number,
 *   height: number,
 *   viewportWidth: number,
 *   viewportHeight: number,
 *   padding?: number
 * }} options
 */
export function clampContextMenuPosition({
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  padding = 6
}) {
  return {
    x: Math.max(padding, Math.min(x, viewportWidth - width - padding)),
    y: Math.max(padding, Math.min(y, viewportHeight - height - padding))
  };
}
