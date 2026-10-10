import type { TodoStore } from "$lib/features/todo/todoStore.svelte.ts";
import type { DailyStore } from "$lib/features/daily/dailyStore.svelte.ts";
import type { WeekStore } from "$lib/features/weekly/weekStore.svelte.ts";
import type { ScratchpadStore } from "$lib/features/scratchpad/scratchpadStore.svelte.ts";

export type View = "todo" | "scratchpad" | "week" | "day";
export type Destination = {view:"todo";path:""} | {view:"scratchpad";path:string} | {view:"week";path:string} | {view:"day";path:string};
export type DestinationInput = {view?:string;path?:string};
type TabBase = {
    id: string;
    title: string;
    path: string;
};
export type WorkspaceTab = TabBase & ({view:"todo"} | {view:"scratchpad"} | {view:"week"} | {view:"day";date:string});
export type PaneSide = "left" | "right";
export interface WorkspaceSession {
    todoStore: TodoStore;
    dailyStore: DailyStore;
    weekStore: WeekStore;
    scratchpadStore: ScratchpadStore;
}
export function isView(view: string | undefined): view is View {
  return view === "todo" || view === "scratchpad" || view === "week" || view === "day";
}

export type SessionStore = WorkspaceSession[keyof WorkspaceSession];
export interface TransferOptions {isCurrent?:()=>boolean;commit?:()=>void}
export interface OpenOptions {background?:boolean}
export type TransferAcceptor = (tab:WorkspaceTab, store:SessionStore | null, options:TransferOptions)=>Promise<boolean | undefined>;
export interface ExpansionCommand {id:number;expanded:boolean}
export type FocusDetail = {view:View;path:string};
