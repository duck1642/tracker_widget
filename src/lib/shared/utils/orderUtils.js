// @ts-nocheck
export function movedByDirection(items, itemId, direction) {
  const index = items.findIndex((item) => item.id === itemId);
  const targetIndex = direction === "up" ? index - 1 : direction === "down" ? index + 1 : -1;
  if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return null;
  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
