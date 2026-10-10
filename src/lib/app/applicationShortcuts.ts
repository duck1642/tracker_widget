
export function suppressPrintShortcut(event: KeyboardEvent) {
  const modifierPressed = event.ctrlKey || event.metaKey;
  if (!modifierPressed || event.altKey || event.shiftKey || event.key.toLowerCase() !== "p") return false;

  event.preventDefault();
  event.stopPropagation();
  return true;
}
