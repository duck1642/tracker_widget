/** @param {KeyboardEvent} event */
export function suppressPrintShortcut(event) {
  const modifierPressed = event.ctrlKey || event.metaKey;
  if (!modifierPressed || event.altKey || event.shiftKey || event.key.toLowerCase() !== "p") return false;

  event.preventDefault();
  event.stopPropagation();
  return true;
}
