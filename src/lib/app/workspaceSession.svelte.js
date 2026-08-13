import { TodoStore } from "$lib/features/todo/todoStore.svelte.js";
import { DailyStore } from "$lib/features/daily/dailyStore.svelte.js";
import { WeekStore } from "$lib/features/weekly/weekStore.svelte.js";
import { ScratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.js";

export function createWorkspaceSession() {
  const weekStore = new WeekStore();
  return {
    todoStore: new TodoStore(),
    weekStore,
    dailyStore: new DailyStore({ weekStore }),
    scratchpadStore: new ScratchpadStore()
  };
}
