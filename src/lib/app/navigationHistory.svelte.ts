import { isView } from "./types.ts";
import type { Destination, DestinationInput } from "./types.ts";


function normalizeDestination(destination: DestinationInput | null | undefined): Destination {
  const view = isView(destination?.view) ? destination.view : "todo";
  return view === "todo" ? {view, path:""} : {view, path: String(destination?.path || "")};
}

function sameDestination(left: Destination | undefined, right: Destination | undefined) {
  return left?.view === right?.view && left?.path === right?.path;
}

export class NavigationHistory {
  limit:number;
  entries = $state<Destination[]>([]);
  index = $state(-1);

  constructor(initialDestination: DestinationInput = { view: "todo", path: "" }, { limit = 128 } = {}) {
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

  visit(destination: DestinationInput) {
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

  removePathsUnder(folderPath:string) {
    const normalizedFolder = String(folderPath || "").replace(/[\\/]+$/, "");
    if (!normalizedFolder) return false;
    const belongsToFolder = (destination: Destination) =>
      destination.view !== "todo"
      && (destination.path === normalizedFolder
        || destination.path.startsWith(`${normalizedFolder}\\`)
        || destination.path.startsWith(`${normalizedFolder}/`));
    const next: Destination[] = [];
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
