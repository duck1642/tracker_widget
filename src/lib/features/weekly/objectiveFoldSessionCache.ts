import type { Objective } from "$lib/shared/parsers/types.ts";
import { getFoldableObjectiveIds } from "./objectiveFolding.ts";

const DEFAULT_LIMIT = 256;
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

export function objectiveStructureFingerprint(objectives: Objective[]) {
  const canonical = JSON.stringify(objectives.map((objective) => [
    objective.subjects || [],
    objective.status || "",
    objective.description || "",
    objective.indent || 0
  ]));
  let hash = FNV_OFFSET;
  for (const character of canonical) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = (hash * FNV_PRIME) & UINT64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

export class ObjectiveFoldSessionCache {
  limit:number; entries:Map<string, {fingerprint:string;foldedIndexes:number[]}>;
  constructor(limit = DEFAULT_LIMIT) {
    this.limit = Math.max(1, Number(limit) || DEFAULT_LIMIT);
    this.entries = new Map();
  }

  get size() {
    return this.entries.size;
  }

  has(path: string) {
    return this.entries.has(path);
  }

  delete(path: string) {
    this.entries.delete(path);
  }

  save(path: string, objectives: Objective[], foldedObjectiveIds: string[]) {
    if (!path) return;
    const foldableIds = getFoldableObjectiveIds(objectives);
    const foldedIds = new Set(foldedObjectiveIds.filter((id) => foldableIds.has(id)));
    const foldedIndexes: number[] = [];
    objectives.forEach((objective, index) => {
      if (foldedIds.has(objective.id)) foldedIndexes.push(index);
    });

    if (!foldedIndexes.length) {
      this.delete(path);
      return;
    }

    this.entries.delete(path);
    this.entries.set(path, {
      fingerprint: objectiveStructureFingerprint(objectives),
      foldedIndexes
    });

    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  restore(path: string, objectives: Objective[]) {
    const entry = this.entries.get(path);
    if (!entry) return [];
    if (entry.fingerprint !== objectiveStructureFingerprint(objectives)) {
      this.delete(path);
      return [];
    }

    this.entries.delete(path);
    this.entries.set(path, entry);
    const foldableIds = getFoldableObjectiveIds(objectives);
    return entry.foldedIndexes
      .map((index) => objectives[index]?.id)
      .filter((id): id is string => id !== undefined && foldableIds.has(id));
  }
}
