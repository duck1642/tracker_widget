import type { Objective } from "$lib/shared/parsers/types.ts";
export function getFoldableObjectiveIds(objectives: Pick<Objective,"id"|"indent">[]) {
  const ids = new Set<string>();
  for (let index = 0; index < objectives.length - 1; index += 1) {
    if ((objectives[index + 1].indent || 0) > (objectives[index].indent || 0)) {
      ids.add(objectives[index].id);
    }
  }
  return ids;
}

export function buildVisibleObjectiveRows<T extends Pick<Objective,"id"|"indent">>(objectives: T[], foldedObjectiveIds: string[]) {
  const foldableIds = getFoldableObjectiveIds(objectives);
  const foldedIds = new Set(foldedObjectiveIds.filter((id) => foldableIds.has(id)));
  const foldedAncestorIndents: number[] = [];
  const rows: {
      objective: T;
      index: number;
      hasChildren: boolean;
      isFolded: boolean;
  }[] = [];

  for (let index = 0; index < objectives.length; index += 1) {
    const objective = objectives[index];
    const indent = objective.indent || 0;

    while (foldedAncestorIndents.length && indent <= foldedAncestorIndents[foldedAncestorIndents.length - 1]) {
      foldedAncestorIndents.pop();
    }

    const hasChildren = foldableIds.has(objective.id);
    const isFolded = foldedIds.has(objective.id);
    if (foldedAncestorIndents.length === 0) {
      rows.push({ objective, index, hasChildren, isFolded });
    }
    if (isFolded) foldedAncestorIndents.push(indent);
  }

  return { rows, foldedIds: [...foldedIds] };
}
