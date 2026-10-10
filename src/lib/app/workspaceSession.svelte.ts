import type { WorkspaceSession } from "./types.ts";
import { TodoStore } from "$lib/features/todo/todoStore.svelte.ts";
import { DailyStore } from "$lib/features/daily/dailyStore.svelte.ts";
import { WeekStore } from "$lib/features/weekly/weekStore.svelte.ts";
import { ScratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.ts";

export function createWorkspaceSession(): WorkspaceSession {
  const weekStore = new WeekStore();
  return {
    todoStore: new TodoStore(),
    weekStore,
    dailyStore: new DailyStore({ weekStore }),
    scratchpadStore: new ScratchpadStore()
  };
}
