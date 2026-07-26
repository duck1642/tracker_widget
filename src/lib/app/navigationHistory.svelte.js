// @ts-nocheck
const VALID_VIEWS = new Set(["todo", "scratchpad", "week", "day"]);

function normalizeDestination(destination) {
  const view = VALID_VIEWS.has(destination?.view) ? destination.view : "todo";
  return {
    view,
    path: view === "todo" ? "" : String(destination?.path || "")
  };
}

function sameDestination(left, right) {
  return left?.view === right?.view && left?.path === right?.path;
}

export class NavigationHistory {
  entries = $state([]);
  index = $state(-1);

  constructor(initialDestination = { view: "todo", path: "" }, { limit = 128 } = {}) {
    this.limit = Math.max(2, limit);
    this.entries = [normalizeDestination(initialDestination)];
    this.index = 0;
  }

  get canGoBack() {
    return this.index > 0;
  }

  get canGoForward() {
    return this.index >= 0 && this.index < this.entries.length - 1;
  }

  visit(destination) {
    const next = normalizeDestination(destination);
    if (sameDestination(this.entries[this.index], next)) return false;

    const entries = [...this.entries.slice(0, this.index + 1), next];
    if (entries.length > this.limit) entries.splice(0, entries.length - this.limit);
    this.entries = entries;
    this.index = entries.length - 1;
    return true;
  }

  back() {
    if (!this.canGoBack) return null;
    this.index -= 1;
    return this.entries[this.index];
  }

  forward() {
    if (!this.canGoForward) return null;
    this.index += 1;
    return this.entries[this.index];
  }

  removePathsUnder(folderPath) {
    const normalizedFolder = String(folderPath || "").replace(/[\\/]+$/, "");
    if (!normalizedFolder) return false;
    const belongsToFolder = (destination) =>
      destination.view !== "todo"
      && (destination.path === normalizedFolder
        || destination.path.startsWith(`${normalizedFolder}\\`)
        || destination.path.startsWith(`${normalizedFolder}/`));
    const next = [];
    let nextIndex = -1;
    for (let index = 0; index < this.entries.length; index += 1) {
      if (belongsToFolder(this.entries[index])) continue;
      next.push(this.entries[index]);
      if (index <= this.index) nextIndex = next.length - 1;
    }
    if (next.length === this.entries.length) return false;
    if (!next.length) next.push({ view: "todo", path: "" });
    this.entries = next;
    this.index = Math.max(0, nextIndex);
    return true;
  }
}
